import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { EditKind, Live, Route, View } from '../types'
import { ROUTE_DESCRIPTION, ROUTE_SCHEMA, ROUTE_TOOL } from './contract'
import {
  applyDecide,
  applyPatch,
  applySet,
  applyStep,
  counts,
  deliverEdits,
  isClosed,
  isTestCommand,
  ownersOf,
  promptNote,
  readTestOutput,
  reconcile,
  routeView,
  seeTestRun,
  seeWrite,
  undoEdit,
  userEdit,
} from './model'
import type { Answer } from './model'
import { drawLab } from './lab'
import type { LabPage } from './lab'
import { drawBand, drawPane } from './pane'
import type { Actions, Elements } from './pane'
import { activityFor } from './text'

// Flight Plan: a live map of what Claude is doing, beside the chat. Claude
// files the route through the `route` tool; the map moves the plane on what
// it sees (writes to each step's files, test runs) and on Claude's reports;
// the person's changes land on the map at once and reach Claude on its next
// tool result.

const PANE = 'flightplan'
const TITLE = 'Flight Plan'
const TOOL = 'mcp__flightplan__route'
const WRITES = new Set(['Write', 'Edit', 'NotebookEdit'])
const GO = /^Go: take off/

const INITIAL_LIVE: Live = {
  isRunning: false,
  turnId: '',
  turnStartedAt: 0,
  activity: '',
  activityAt: 0,
  lastCommand: '',
  waiting: null,
  errorsInRow: 0,
  failedRuns: 0,
  helpers: [],
  celebrateUntil: 0,
  cost: null,
  contextPercent: null,
  heldTurnEnd: false,
}

const INITIAL_VIEW: View = {
  open: null,
  isDetailsOn: false,
  isLegendOn: false,
  countdown: 30,
  isCountdown: false,
  armedStop: null,
  isPlaced: false,
  whereAnswer: '',
  isSoundOn: true,
}

const routeAtom = atom({ plugin: 'flightplan', key: 'route' } as const, null)
const liveAtom = atom({ plugin: 'flightplan', key: 'live' } as const, INITIAL_LIVE)
const viewAtom = atom({ plugin: 'flightplan', key: 'view' } as const, INITIAL_VIEW)

type Sound = 'tick' | 'chime' | 'knock' | 'fanfare'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const config: { departure: 'countdown' | 'go' | 'auto'; countdownSeconds: number; soundMode: 'all' | 'important' | 'off'; isCalm: boolean } = {
  departure: 'countdown',
  countdownSeconds: 30,
  soundMode: 'all',
  isCalm: false,
}

// Per-module memory (a reload starts these over; the route itself is in $.state).
let countdown: { cancel: () => void } | null = null
let lastSoundAt = 0
let approvedAt = 0
let turnWrites = 0
let persisting: Promise<void> = Promise.resolve()
const nudged = new Set<string>()
const deniedFiles = new Set<string>()

// The lab (/flight lab): checks for v2's pictures, answered by the person in
// the desktop app and saved where Claude reads them. Removed before release.
const LAB = 'flightplan-lab'
const LAB_OUT = `${process.env.TMPDIR ?? '/tmp'}/flightplan-lab-results.json`
const lab = {
  page: 'redraw' as LabPage,
  tick: 0,
  replay: 0,
  columns: 0,
  placement: '',
  answers: {} as Record<string, string>,
  isDone: false,
  events: [] as { at: number; what: string }[],
}
let labTimer: { cancel: () => void } | null = null

// ------------------------------------------------------------ state

async function mutate<T>($: EngineInterface, fn: (route: Route) => T): Promise<T | undefined> {
  let out: T | undefined
  await update($, routeAtom, current => {
    if (current === null) return current
    const next = clone(current)
    out = fn(next)

    return next
  })
  await persist($)

  return out
}

function setLive($: EngineInterface, fn: (live: Live) => Partial<Live>) {
  return update($, liveAtom, live => ({ ...(live ?? INITIAL_LIVE), ...fn(live ?? INITIAL_LIVE) }))
}

function setView($: EngineInterface, fn: (view: View) => Partial<View>) {
  return update($, viewAtom, view => ({ ...(view ?? INITIAL_VIEW), ...fn(view ?? INITIAL_VIEW) }))
}

// The route outlives the process: a resumed session, or an app restart, gets
// its map back. One key per session, the newest version wins, and the oldest
// sessions are dropped past twenty. Saves run one after another.
function persist($: EngineInterface): Promise<void> {
  persisting = persisting.then(() => saveRoute($)).catch(() => undefined)

  return persisting
}

async function saveRoute($: EngineInterface) {
  try {
    const route = await read($, routeAtom)
    if (route === null) return
    const key = `route:${await $.session.id()}`
    const saved = (await $.store.get(key)) as { route?: Route } | undefined
    if (saved?.route !== undefined && saved.route.version > route.version && saved.route.setAt === route.setAt) return
    await $.store.set(key, { savedAt: await $.clock.now(), route })
    const keys = (await $.store.keys()).filter(one => one.startsWith('route:'))
    if (keys.length > 20) {
      const dated = await Promise.all(keys.map(async one => ({ key: one, at: ((await $.store.get(one)) as { savedAt?: number } | undefined)?.savedAt ?? 0 })))
      for (const old of dated.sort((a, b) => a.at - b.at).slice(0, keys.length - 20)) await $.store.delete(old.key)
    }
  } catch {
    // persistence is a convenience; the live map does not depend on it
  }
}

async function restore($: EngineInterface) {
  try {
    if ((await read($, routeAtom)) !== null) return
    const saved = (await $.store.get(`route:${await $.session.id()}`)) as { route?: Route } | undefined
    if (saved?.route !== undefined) await update($, routeAtom, () => saved.route ?? null)
  } catch {
    // nothing saved, or the store is unavailable
  }
}

async function forget($: EngineInterface) {
  stopCountdown()
  deniedFiles.clear()
  nudged.clear()
  turnWrites = 0
  await update($, routeAtom, () => null)
  await update($, liveAtom, () => INITIAL_LIVE)
  await setView($, view => ({ ...INITIAL_VIEW, isPlaced: view.isPlaced, isSoundOn: view.isSoundOn, isDetailsOn: view.isDetailsOn }))
}

async function debugLog($: EngineInterface) {
  try {
    const path = await $.env.get('FLIGHTPLAN_LOG')
    if (path === undefined || path === '') return
    await $.fs.write(path, JSON.stringify({ route: await read($, routeAtom), live: await read($, liveAtom) }, null, 2))
  } catch {
    // a debug aid only
  }
}

// ------------------------------------------------------------ surface

// Ticks and chimes share one limiter; the knock (Claude needs you) and the
// landing fanfare always play.
async function play($: EngineInterface, sound: Sound) {
  if (config.soundMode === 'off') return
  const isImportant = sound === 'knock' || sound === 'fanfare'
  if (config.soundMode === 'important' && !isImportant) return
  const view = await read($, viewAtom)
  if (view?.isSoundOn === false) return
  const now = await $.clock.now()
  if (!isImportant) {
    if (now - lastSoundAt < 2000) return
    lastSoundAt = now
  }
  void $.audio.play({ asset: `fx/${sound}.wav` }, { gain: 0.5 }).catch(() => undefined)
}

async function openPane($: EngineInterface): Promise<{ isPlaced: boolean; reason?: string }> {
  try {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    await setView($, () => ({ isPlaced: opened.isPlaced }))

    return opened
  } catch (error) {
    return { isPlaced: false, reason: String(error) }
  }
}

function toast($: EngineInterface, text: string) {
  try {
    $.ui.toast(text)
  } catch {
    // no surface to show it on
  }
}

// ------------------------------------------------------------ the lab

async function openLab($: EngineInterface): Promise<{ isPlaced: boolean; reason?: string }> {
  try {
    const opened = await $.ui.open({ id: LAB, title: 'FP lab' })
    labTimer?.cancel()
    // The redraw page redraws every second; the other pages only on a tap.
    labTimer = $.clock.every(1000, () => {
      if (lab.page !== 'redraw') return
      lab.tick += 1
      $.ui.invalidate('ui.render')
    })
    await labEvent($, 'opened')

    return opened
  } catch (error) {
    return { isPlaced: false, reason: String(error) }
  }
}

async function labEvent($: EngineInterface, what: string) {
  lab.events.push({ at: await $.clock.now(), what })
  await saveLab($)
}

async function saveLab($: EngineInterface) {
  const { page, columns, placement, answers, isDone, events } = lab
  const text = JSON.stringify({ savedAt: await $.clock.now(), isDone, page, columns, placement, answers, events }, null, 2)
  await $.fs.write(LAB_OUT, text).catch(() => undefined)
}

function labActions($: EngineInterface) {
  const redraw = () => $.ui.invalidate('ui.render')

  return {
    page: (page: LabPage) => {
      lab.page = page
      redraw()
      void labEvent($, `page ${page}`)
    },
    answer: (id: string, value: string) => {
      lab.answers[id] = value
      redraw()
      void saveLab($)
    },
    toggle: (id: string, item: string) => {
      const chosen = new Set((lab.answers[id] ?? '').split(',').filter(one => one !== '' && one !== 'none'))
      if (chosen.has(item)) chosen.delete(item)
      else chosen.add(item)
      lab.answers[id] = [...chosen].sort().join(',')
      redraw()
      void saveLab($)
    },
    replay: () => {
      lab.replay += 1
      redraw()
    },
    done: () => {
      lab.isDone = true
      redraw()
      void labEvent($, 'done')
    },
  }
}

// ------------------------------------------------------------ departure

function stopCountdown() {
  countdown?.cancel()
  countdown = null
}

// The countdown runs only for the 'countdown' departure, pauses while the
// person has an editor open, and is re-armed after a reload or a resume.
async function armCountdown($: EngineInterface, isFresh: boolean) {
  if (config.departure !== 'countdown') {
    await setView($, () => ({ isCountdown: false }))
    return
  }
  if (countdown !== null && !isFresh) return
  stopCountdown()
  await setView($, view => ({ isCountdown: true, countdown: isFresh || view.countdown <= 0 ? config.countdownSeconds : view.countdown }))
  countdown = $.clock.every(1000, () => void tick($))
}

async function tick($: EngineInterface) {
  const route = await read($, routeAtom)
  if (route === null || route.gate !== 'waiting') {
    stopCountdown()
    await setView($, () => ({ isCountdown: false }))
    return
  }
  const live = await read($, liveAtom)
  const view = await read($, viewAtom)
  if (live?.isRunning === true || view?.open != null) return
  const left = (view?.countdown ?? config.countdownSeconds) - 1
  if (left <= 0) {
    await takeOff($)
    return
  }
  await setView($, () => ({ countdown: left }))
}

// Exactly one Go per takeoff: the gate flips inside one state write, and only
// the call that flipped it submits.
async function takeOff($: EngineInterface): Promise<boolean> {
  stopCountdown()
  let isMine = false
  let first = ''
  await update($, routeAtom, current => {
    if (current === null || current.gate === 'go') return current
    isMine = true
    first = current.steps.find(step => step.status === 'pending' || step.status === 'active')?.title ?? ''
    const next: Route = { ...current, gate: 'go' }
    return next
  })
  if (!isMine) return false
  await setView($, () => ({ isCountdown: false }))
  await persist($)
  void $.prompt.submit({ text: `Go: take off and start the route${first === '' ? '' : ` with "${first}"`}.`, asUser: true }).catch(() => undefined)

  return true
}

async function hold($: EngineInterface): Promise<boolean> {
  stopCountdown()
  let isHeld = false
  await mutate($, r => {
    if (r.gate === 'waiting') {
      r.gate = 'held'
      isHeld = true
    }
  })
  await setView($, () => ({ isCountdown: false }))

  return isHeld
}

// ------------------------------------------------------------ the person's actions

async function editRoute($: EngineInterface, kind: EditKind, target: string, value: string): Promise<boolean> {
  const now = await $.clock.now()
  const edit = await mutate($, r => userEdit(r, kind, target, value, now))
  await setView($, view => ({ open: kind === 'rename' ? view.open : null, armedStop: null }))
  if (edit === undefined) return false
  const live = await read($, liveAtom)
  const route = await read($, routeAtom)
  // On the map now; Claude reads it on its next tool result while working,
  // or with the next message while idle. Before takeoff it rides "Go".
  toast(
    $,
    kind === 'checked'
      ? 'Marked as checked by you.'
      : route?.gate === 'waiting' || route?.gate === 'held'
        ? 'Changed on the map. Claude reads it when it takes off.'
        : live?.isRunning
          ? 'Changed on the map. Claude reads it on its next step.'
          : 'Changed on the map. Claude reads it with your next message, or press Send now.',
  )

  return true
}

async function sendNow($: EngineInterface) {
  const now = await $.clock.now()
  const text = await mutate($, r => deliverEdits(r, now, true))
  if (text === undefined) {
    toast($, 'Nothing waiting to send.')
    return
  }
  void $.prompt.submit({ text: `${text}\nApply these now and update the map.`, asUser: true }).catch(() => undefined)
}

async function resume($: EngineInterface) {
  await mutate($, r => {
    for (const edit of r.edits.filter(one => one.kind === 'pause' && one.state === 'queued')) undoEdit(r, edit.id)
    r.isPaused = false
  })
  void $.prompt.submit({ text: 'Continue the route from where you stopped.', asUser: true }).catch(() => undefined)
}

async function stopNow($: EngineInterface, stepId: string) {
  let isArmed = false
  await update($, viewAtom, view => {
    const current = view ?? INITIAL_VIEW
    isArmed = current.armedStop === stepId

    return { ...current, armedStop: isArmed ? null : stepId, open: isArmed ? null : current.open }
  })
  if (!isArmed) {
    toast($, 'Press Stop now again to interrupt Claude. A file may be left half-edited; Claude is told to check.')
    return
  }
  const live = await read($, liveAtom)
  if (live?.isRunning === true && live.turnId !== '') {
    await $.turn.abort({ turnId: live.turnId }).catch(() => undefined)
  }
  const now = await $.clock.now()
  const text = (await mutate($, r => deliverEdits(r, now, true))) ?? ''
  void $.prompt
    .submit({
      text: `Stop. The user interrupted the step you were on. Check for half-finished edits first, then re-plan with the Flight Plan map.${text === '' ? '' : `\n${text}`}`,
      asUser: true,
    })
    .catch(() => undefined)
}

async function where($: EngineInterface) {
  await setView($, () => ({ whereAnswer: 'Asking Claude… (uses about one message of your plan)' }))
  const forked = await $.model.fork({
    prompt: 'In three short plain-English lines for someone who does not code: what is done, what you are doing now, and what is next.',
  })
  await setView($, () => ({ whereAnswer: forked.isAnswered ? forked.text.trim() : `Claude could not answer just now (${forked.reason}).` }))
}

function actions($: EngineInterface): Actions {
  const ask = (text: string) => void $.prompt.submit({ text, asUser: true }).catch(() => undefined)

  return {
    open: id => {
      void (async () => {
        // Opening an editor at the gate holds the countdown while you read.
        await setView($, () => ({ open: id, armedStop: null }))
      })()
    },
    edit: (kind, target, value) => void editRoute($, kind, target, value ?? ''),
    undo: editId => {
      void (async () => {
        const isUndone = await mutate($, r => undoEdit(r, editId))
        toast($, isUndone ? 'Undone before Claude saw it.' : 'Claude has already seen that change.')
      })()
    },
    takeOff: () => void takeOff($),
    hold: () => void hold($),
    pause: () => {
      void (async () => {
        const route = await read($, routeAtom)
        const queued = route?.edits.find(edit => edit.kind === 'pause' && edit.state === 'queued')
        if (queued !== undefined) {
          await mutate($, r => undoEdit(r, queued.id))
          toast($, 'Pause cancelled.')
        } else await editRoute($, 'pause', 'route', '')
      })()
    },
    resume: () => void resume($),
    stopNow: stepId => void stopNow($, stepId),
    askToCheck: () => ask('Run the checks for the steps the map shows as "done, not tested", then close them on the map with what you found.'),
    askToUpdate: () => ask('Update the Flight Plan map: close the steps you finished with route step (finish takes several ids, with evidence), then say in one line what is left.'),
    askWhy: decisionId => {
      void (async () => {
        const route = await read($, routeAtom)
        const decision = route?.decisions.find(one => one.id === decisionId)
        if (decision !== undefined) ask(`Why did you choose ${decision.choice} for "${decision.question}"? One short paragraph for someone who does not code.`)
      })()
    },
    keep: decisionId => {
      void mutate($, r => {
        const decision = r.decisions.find(one => one.id === decisionId)
        if (decision !== undefined) decision.state = 'kept'
      })
      void setView($, () => ({ open: null }))
    },
    askFirst: () =>
      void editRoute($, 'note', 'route', 'asks: from now on, ask them with AskUserQuestion before choosing a library, a service or an architecture'),
    where: () => void where($),
    toggleDetails: () => void setView($, view => ({ isDetailsOn: !view.isDetailsOn })),
    toggleLegend: () => void setView($, view => ({ isLegendOn: !view.isLegendOn })),
    sendNow: () => void sendNow($),
    showQuestion: () => {
      void (async () => {
        const live = await read($, liveAtom)
        if (live?.waiting != null) await $.ui.scroll({ to: { requestId: live.waiting.toolUseId } }).catch(() => undefined)
      })()
    },
    nudge: () => {
      void (async () => {
        const route = await read($, routeAtom)
        await editRoute($, 'nudge', route?.plane ?? 'route', 'asks you to stop and try a different approach for the step you are on now, or to ask them a question')
      })()
    },
    dismissWhere: () => void setView($, () => ({ whereAnswer: '' })),
  }
}

// ------------------------------------------------------------ hooks

export const register: Register = (on, options) => {
  config.departure = options.departure === 'go' || options.departure === 'auto' ? options.departure : 'countdown'
  config.countdownSeconds = typeof options.countdownSeconds === 'number' && options.countdownSeconds >= 5 ? Math.round(options.countdownSeconds) : 30
  config.soundMode = options.sounds === 'important' || options.sounds === 'off' ? options.sounds : 'all'
  config.isCalm = options.fun === 'calm'
  const { departure, countdownSeconds, isCalm } = config

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: ROUTE_TOOL, description: ROUTE_DESCRIPTION, inputSchema: ROUTE_SCHEMA, isDeferred: false })
    await $.command.register({
      name: 'flight',
      description: 'Open the Flight Plan map (also: go, hold, pause, show, details, sound on|off)',
      argumentHint: '[go|hold|pause|show|details|sound on|off]',
      immediate: true,
    })
    // Time-based words ("12s ago", the plane leaving its flying pose) need a
    // redraw now and then, only while something is happening.
    $.clock.every(5000, () => {
      void (async () => {
        const live = await read($, liveAtom)
        const route = await read($, routeAtom)
        if (live?.isRunning === true || (route !== null && route.gate === 'waiting')) $.ui.invalidate('ui.render')
      })()
    })
    await restore($)
    const route = await read($, routeAtom)
    if (route !== null && route.landedAt === 0 && route.steps.length > 0) {
      void openPane($)
      if (route.gate === 'waiting') await armCountdown($, false)
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await forget($)

    return next(e)
  })

  on('command.run', { command: 'flight' }, async ($, e) => {
    const [word, rest] = e.args.trim().toLowerCase().split(/\s+/, 2)
    const route = await read($, routeAtom)
    switch (word ?? '') {
      case 'go': {
        const isOff = await takeOff($)
        return { text: isOff ? 'Taking off.' : 'No route is waiting at the gate.' }
      }
      case 'hold': {
        const isHeld = await hold($)
        return { text: isHeld ? 'Holding: change anything on the map, then press Take off.' : 'No route is waiting at the gate.' }
      }
      case 'pause': {
        if (route === null || route.landedAt > 0) return { text: 'No flight in progress.' }
        await editRoute($, 'pause', 'route', '')
        return { text: 'Claude will finish the step it is on, update the map, and stop.' }
      }
      case 'details':
        await setView($, view => ({ isDetailsOn: !view.isDetailsOn }))
        return { text: 'Toggled details on the map.' }
      case 'sound':
        await setView($, () => ({ isSoundOn: rest !== 'off' }))
        return { text: rest === 'off' ? 'Flight Plan sounds off.' : 'Flight Plan sounds on.' }
      case 'show': {
        if (route === null) return { text: 'No flight plan yet.' }
        const c = counts(route)
        const lines = route.steps.map(step => `${step.id === route.plane ? '✈' : isClosed(step) ? 'v' : step.status === 'removed' ? 'x' : 'o'} ${step.title} (${step.status})`)
        return { text: [`${route.goal}: ${c.done} of ${c.total} done`, ...lines].join('\n') }
      }
      case 'lab': {
        const opened = await openLab($)
        return { text: opened.isPlaced ? 'Lab opened beside the chat.' : `The lab is open but not on screen yet: ${opened.reason}` }
      }
      default: {
        const opened = await openPane($)
        return { text: opened.isPlaced ? 'Flight Plan map opened.' : `The map is open but not on screen yet: ${opened.reason}` }
      }
    }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    const closed = await next(e)
    await setView($, () => ({ isPlaced: false }))

    return closed
  })

  on('ui.close', { id: LAB }, async ($, e, next) => {
    const closed = await next(e)
    labTimer?.cancel()
    labTimer = null
    await labEvent($, 'closed')

    return closed
  })

  // ------------------------------------------------------------ the route tool

  on('tool.call', { tool: 'mcp__flightplan__route' }, async ($, e) => {
    if (e.agentId !== undefined) return { result: JSON.stringify({ ok: true, note: 'Only the main conversation updates the map.' }) }
    const input = e as unknown as Record<string, unknown>
    const now = await $.clock.now()
    const before = await read($, routeAtom)
    const checkedBefore = before === null ? 0 : counts(before).checked
    let answer: Answer = { result: { ok: false, error: 'unknown op; use set, step, patch, decide or get' }, context: [] }
    let wasSet = false

    await update($, routeAtom, current => {
      const route = current === null ? null : clone(current)
      if (input.op === 'set') {
        const isApproved = approvedAt > 0 && now - approvedAt < 10 * 60_000
        const out = applySet(route, input, now, { departure, countdownSeconds, isApproved })
        answer = out.answer
        wasSet = out.answer.result.ok === true
        return out.route
      }
      if (route === null) {
        answer = { result: { ok: false, error: 'no route yet: call set first' }, context: [] }
        return current
      }
      if (input.op === 'step') answer = applyStep(route, input, now)
      else if (input.op === 'patch') answer = applyPatch(route, input, now)
      else if (input.op === 'decide') answer = applyDecide(route, input, now)
      else if (input.op === 'get') answer = { result: routeView(route), context: [] }
      // The checkpoint: changes the person made ride back with every report.
      const delivered = deliverEdits(route, now)
      if (delivered !== undefined) {
        answer.result = { ...answer.result, userEdits: route.edits.filter(edit => edit.state === 'delivered').map(edit => ({ id: edit.id, text: edit.text })) }
        answer.context = [...answer.context, delivered]
      }
      if (route.isPaused) answer.context = [...answer.context, 'The user asked to pause: do not start another step. Reply with a two-line summary and end your turn.']

      return route
    })

    await persist($)
    const after = await read($, routeAtom)
    if (wasSet && after !== null) {
      await setView($, () => ({ open: null }))
      void openPane($)
      if (after.gate === 'waiting') await armCountdown($, true)
    }
    if (after !== null && counts(after).checked > checkedBefore) {
      await setLive($, () => ({ celebrateUntil: now + 2500 }))
      await play($, 'tick')
    }

    // A plugin tool answers text (or content blocks), never an object: the
    // engine checks the shape and turns anything else into a tool error.
    const text = JSON.stringify(answer.result)

    return answer.context.length > 0 ? { result: text, context: answer.context } : { result: text }
  }).catch(() => ({ result: JSON.stringify({ ok: false, error: 'The map hit an error recording this; carry on with the task.' }) }))

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    approvedAt = await $.clock.now()

    return { ...ran, context: [...(ran.context ?? []), 'Flight Plan: file this approved plan on the map now with mcp__flightplan__route op set (each step with its files and check), then start.'] }
  })

  // ------------------------------------------------------------ what the map sees

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    if (tool === TOOL || tool === 'ExitPlanMode') return next(e)
    if (e.agentId !== undefined) return next(e)
    const now = await $.clock.now()
    const file =
      e.tool === 'Write' || e.tool === 'Edit' || e.tool === 'Read' ? e.file_path : e.tool === 'NotebookEdit' ? e.notebook_path : undefined
    const command = e.tool === 'Bash' ? e.command : undefined
    const description = e.tool === 'Bash' ? e.description : undefined
    const isBackground = e.tool === 'Bash' && e.run_in_background === true
    const isWrite = WRITES.has(tool) && file !== undefined
    let route = await read($, routeAtom)

    // A file that belongs only to steps the person removed: refused once,
    // with the reason, after Claude has been told.
    if (isWrite && route !== null && !deniedFiles.has(file)) {
      const owners = ownersOf(route, file)
      const removal = route.edits.find(
        edit => edit.kind === 'remove' && edit.state !== 'queued' && owners.some(step => step.id === edit.target || step.featureId === edit.target),
      )
      if (owners.length > 0 && owners.every(step => step.status === 'removed' && step.removedBy === 'you') && removal !== undefined) {
        deniedFiles.add(file)
        return { deny: `The user removed "${owners[0]?.title ?? file}" on the Flight Plan map, so this file is not to be written. Continue with the next step.` }
      }
    }

    await setLive($, () => ({
      activity: activityFor(tool, file, command, description),
      activityAt: now,
      ...(command !== undefined ? { lastCommand: command } : {}),
    }))

    if (e.tool === 'AskUserQuestion') {
      await setLive($, () => ({ waiting: { question: e.questions[0]?.question ?? 'a question', toolUseId: e.tool_use_id } }))
      await play($, 'knock')
    }
    if (tool === 'Agent' || tool === 'Task') {
      const about = 'description' in e && typeof e.description === 'string' ? e.description : 'a side task'
      await setLive($, live => ({ helpers: [...live.helpers.filter(one => !one.isDone).slice(-4), { id: e.tool_use_id, description: about, isDone: false }] }))
    }

    // Leaving the departure gate early: the card collapses, edits still land.
    if (isWrite && route !== null && (route.gate === 'waiting' || route.gate === 'held')) {
      stopCountdown()
      await mutate($, r => {
        r.gate = 'go'
      })
      await setView($, () => ({ isCountdown: false }))
    }

    const ran = await next(e)
    const isDenied = ran.deny !== undefined
    const isError = isDenied || ran.isError === true
    const finished = await $.clock.now()

    if (e.tool === 'AskUserQuestion') await setLive($, () => ({ waiting: null }))
    if (tool === 'Agent' || tool === 'Task') await setLive($, live => ({ helpers: live.helpers.map(one => (one.id === e.tool_use_id ? { ...one, isDone: true } : one)) }))
    await setLive($, live => ({ errorsInRow: isDenied ? live.errorsInRow : isError ? live.errorsInRow + 1 : 0, activityAt: finished }))

    const context: string[] = []
    route = await read($, routeAtom)
    if (route === null) {
      if (isWrite && !isError) {
        turnWrites += 1
        if (turnWrites >= 2 && !nudged.has('no-route')) {
          nudged.add('no-route')
          context.push("Flight Plan: this looks like multi-step work. File it on the user's map with mcp__flightplan__route op set (steps with files and check), then carry on.")
        }
      }
    } else {
      const checkedBefore = counts(route).checked
      if (isWrite && !isError) {
        const seen = await mutate($, r => seeWrite(r, file, finished))
        if (seen?.kind === 'step' && seen.moved) {
          await setLive($, () => ({ failedRuns: 0 }))
          $.clock.after(1600, () => $.ui.invalidate('ui.render'))
        }
        if (seen?.kind === 'unplanned' && route.landedAt > 0) {
          turnWrites += 1
          if (turnWrites >= 2 && !nudged.has('no-route')) {
            nudged.add('no-route')
            context.push("Flight Plan: the last route has landed. If this is new multi-step work, file it on the user's map with mcp__flightplan__route op set.")
          }
        }
      }
      // Test evidence only from runs that actually ran in the foreground.
      if (command !== undefined && isTestCommand(command) && !isDenied && !isBackground) {
        const summary = readTestOutput(typeof ran.text === 'string' ? ran.text : '', isError)
        const changed = await mutate($, r => seeTestRun(r, command, summary, finished))
        if (summary.isOk === false) await setLive($, live => ({ failedRuns: live.failedRuns + 1 }))
        if (summary.isOk === true) await setLive($, () => ({ failedRuns: 0 }))
        const open = route.steps.filter(step => step.status === 'active' || step.status === 'done')
        if (summary.isOk === true && open.length > 0 && !nudged.has('tests')) {
          nudged.add('tests')
          context.push('Flight Plan: the checks ran. Before you reply, close the steps this run covered with one route step call (finish takes several ids; evidence: this run).')
        }
        if ((changed ?? []).length > 0 && summary.isOk === true) await setLive($, () => ({ celebrateUntil: finished + 2500 }))
      }
      const after = await read($, routeAtom)
      if (after !== null && counts(after).checked > checkedBefore) {
        const isWaypointDone = after.features.some(feature => {
          const steps = after.steps.filter(step => step.featureId === feature.id && step.status !== 'removed')
          const was = route?.steps.filter(step => step.featureId === feature.id && step.status !== 'removed') ?? []
          return steps.length > 0 && steps.every(step => step.status === 'checked') && !was.every(step => step.status === 'checked')
        })
        await play($, isWaypointDone ? 'chime' : 'tick')
      }
      // The fast lane: the person's changes ride Claude's very next tool
      // result. A refused call carries no context, so nothing is handed over.
      if (!isDenied) {
        const delivered = await mutate($, r => deliverEdits(r, finished))
        if (delivered !== undefined) context.push(delivered)
      }
    }

    if (context.length === 0 || isDenied) return ran

    return { ...ran, context: [...(ran.context ?? []), ...context] }
  }).catch(($, e, next) => next(e))

  // ------------------------------------------------------------ turns and prompts

  on('prompt.submit', async ($, e, next) => {
    let route = await read($, routeAtom)
    if (route !== null && (route.gate === 'waiting' || route.gate === 'held')) {
      if (GO.test(e.text)) {
        stopCountdown()
        await mutate($, r => {
          r.gate = 'go'
        })
        await setView($, () => ({ isCountdown: false }))
      } else if (route.gate === 'waiting') {
        // Anything else said at the gate holds it: the person is talking.
        await hold($)
      }
      route = await read($, routeAtom)
    }
    const context = [...(e.context ?? []), promptNote(route)]
    const submitted = await next({ ...e, context })
    // Hand queued changes over only on a prompt that goes through.
    if (route !== null && !('drop' in submitted)) {
      const now = await $.clock.now()
      const delivered = await mutate($, r => deliverEdits(r, now))
      if (delivered !== undefined) return { ...submitted, context: [...(submitted.context ?? []), delivered] }
    }

    return submitted
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    turnWrites = 0
    nudged.clear()
    await setLive($, () => ({ isRunning: true, turnId: e.turnId, turnStartedAt: now, errorsInRow: 0, failedRuns: 0, activity: 'thinking', activityAt: now }))
    const route = await read($, routeAtom)
    if (route?.isPaused === true && !route.edits.some(edit => edit.kind === 'pause' && edit.state === 'queued')) {
      await mutate($, r => {
        r.isPaused = false
      })
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    const now = await $.clock.now()
    const landed = await mutate($, r => reconcile(r, now))
    const usage = await $.session.usage().catch(() => undefined)
    await setLive($, () => ({
      isRunning: false,
      waiting: null,
      activity: '',
      activityAt: now,
      helpers: [],
      cost: usage?.cost?.usd ?? null,
      contextPercent: usage?.context.percent ?? null,
    }))
    await debugLog($)
    const route = await read($, routeAtom)
    if (route?.gate === 'waiting') await armCountdown($, false)
    if (landed?.hasLanded === true) {
      await setLive($, () => ({ celebrateUntil: now + 3000 }))
      await play($, 'fanfare')
      const failing = route?.tests !== null && route?.tests !== undefined && route.tests.failed > 0
      toast($, failing ? `Landed, but the last test run had ${route?.tests?.failed} failing.` : 'Landed: every step on the route is done.')
    } else if (landed !== undefined && landed.blocked > 0 && landed.open.length === landed.blocked) {
      toast($, `Every step is done except ${landed.blocked} blocked. See the map.`)
    }

    return ran
  })

  // ------------------------------------------------------------ drawing

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const route = await read($, routeAtom)
    const live = (await read($, liveAtom)) ?? INITIAL_LIVE
    const view = (await read($, viewAtom)) ?? INITIAL_VIEW
    const now = await $.clock.now()
    if (e.surface === 'mobile') {
      const { Box, Text } = $.ui.resolve(e)
      const c = route === null ? null : counts(route)

      return (
        <Box flexDirection="column">
          <Text bold>{route?.goal ?? 'Flight Plan'}</Text>
          <Text dimColor>{c === null ? 'No flight plan yet.' : `${c.done} of ${c.total} steps done`}</Text>
        </Box>
      )
    }
    let elements: Elements
    if (e.surface === 'desktop' || e.surface === 'vscode') {
      const table = $.ui.resolve(e)
      elements = { Box: table.Box, Text: table.Text, Button: table.Button, Input: table.Input, Select: table.Select, Svg: table.Svg }
    } else {
      const table = $.ui.resolve(e)
      elements = { Box: table.Box, Text: table.Text, Button: table.Button, Input: table.Input, Select: table.Select }
    }

    return drawPane(
      elements,
      { route, live, view, now, columns: e.props.bodyColumns, isCompact: e.props.placement === 'inline', isCalm },
      actions($),
    )
  })

  on('ui.render', { component: 'Pane', requestId: LAB }, async ($, e) => {
    if (lab.columns !== e.props.bodyColumns || lab.placement !== e.props.placement) {
      lab.columns = e.props.bodyColumns
      lab.placement = e.props.placement
      void labEvent($, `size ${e.props.bodyColumns} ${e.props.placement}`)
    }
    const d = { ...lab, columns: e.props.bodyColumns, placement: e.props.placement }
    if (e.surface === 'desktop' || e.surface === 'vscode') {
      const table = $.ui.resolve(e)

      return drawLab({ Box: table.Box, Text: table.Text, Button: table.Button, Svg: table.Svg }, d, labActions($))
    }
    const table = $.ui.resolve(e)

    return drawLab({ Box: table.Box, Text: table.Text, Button: table.Button }, d, labActions($))
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface === 'mobile') return next(e)
    const route = await read($, routeAtom)
    if (route === null || route.steps.length === 0) return next(e)
    // The band shows only while the map is not on screen.
    const panes = await $.ui.panes().catch(() => [])
    if (panes.some(pane => pane.id === PANE && pane.isPlaced && pane.isShown)) return next(e)
    const view = (await read($, viewAtom)) ?? INITIAL_VIEW
    const live = (await read($, liveAtom)) ?? INITIAL_LIVE
    const now = await $.clock.now()
    const table = $.ui.resolve(e)
    const band = drawBand(
      { Box: table.Box, Text: table.Text, Button: table.Button, Input: table.Input, Select: table.Select },
      { route, live, view, now, columns: e.props.bodyColumns, isCompact: true, isCalm },
      () => void openPane($),
      actions($),
    )

    return band ?? next(e)
  })

  // The spinner names the step only when Claude touched the map this turn,
  // and never over a message the engine shows (compaction, a retry).
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message !== null) return next(e)
    const route = await read($, routeAtom)
    const live = await read($, liveAtom)
    if (route === null || route.landedAt > 0 || route.plane === null || live?.isRunning !== true) return next(e)
    if (Math.max(route.lastClaudeAt, route.movedAt) < live.turnStartedAt) return next(e)
    const step = route.steps.find(one => one.id === route.plane)
    const c = counts(route)
    if (step === undefined || c.position === 0) return next(e)

    return next({ ...e, props: { ...e.props, message: `✈ Step ${c.position} of ${c.total} · ${step.title}` } })
  })
}
