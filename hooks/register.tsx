import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { EditKind, Live, Route, Step, View } from '../types'
import { ROUTE_DESCRIPTION, ROUTE_SCHEMA, ROUTE_TOOL } from './contract'
import {
  applyDecide,
  applyPatch,
  applySet,
  applyStep,
  counts,
  deliverEdits,
  hasReceipts,
  isClosed,
  isStopVerified,
  isTestCommand,
  landingOf,
  ownersOf,
  printable,
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
import { chipKindOf, drawBand, drawPane } from './pane'
import type { Actions, ChipKind, Elements } from './pane'
import { ONE_SHOT_MS, sceneKey } from './scene'
import { activityFor, landingWords, say } from './text'
import type { Voice, WordKey } from './text'

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

const config: { departure: 'countdown' | 'go' | 'auto'; countdownSeconds: number; soundMode: 'all' | 'important' | 'off'; isCalm: boolean; voice: Voice } = {
  departure: 'countdown',
  countdownSeconds: 30,
  soundMode: 'all',
  isCalm: false,
  voice: 'fun',
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

// The sky as it stands, one-shots aside (a calm key draws none).
async function stillOf($: EngineInterface): Promise<string> {
  const route = await read($, routeAtom)
  const live = (await read($, liveAtom)) ?? INITIAL_LIVE

  return JSON.stringify(sceneKey({ route, live, now: 0, columns: 80, isStrip: false, isCalm: true }))
}

// A change to the sky with no event time of its own (the turn ending, a
// question answered, a route call that redraws a pin) is stamped, so a
// one-shot running then is dropped instead of replayed by the new source.
async function markChange($: EngineInterface, still: string, now: number) {
  if ((await stillOf($)) !== still) await setLive($, () => ({ changedAt: now }))
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

// Sounds pair with moments the map saw (motionRules §8): tick = a step's
// receipts, chime = a stop with every step tested or a quiet landing, knock =
// your turn, fanfare = a party landing only. Ticks and chimes share one
// limiter; the knock (Claude needs you) and the landing always play.
async function play($: EngineInterface, sound: Sound, isImportant = sound === 'knock' || sound === 'fanfare') {
  if (config.soundMode === 'off') return
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

// A toast shows wherever the session draws, so its emoji follow the
// plainest of them: ✅ only when every surface is the desktop.
async function toastSurface($: EngineInterface): Promise<string> {
  const surfaces = await $.session.surfaces().catch(() => [])

  return surfaces.length > 0 && surfaces.every(one => one === 'desktop') ? 'desktop' : 'terminal'
}

// A toast in the person's voice.
async function tell($: EngineInterface, key: WordKey, vars: Record<string, string | number> = {}) {
  toast($, say(key, config.voice, vars, await toastSurface($)))
}

// /flight replies are transcript lines, which Claude may read: they stay in
// plain words and text marks whatever the voice (R12).
const reply = (key: WordKey, vars: Record<string, string | number> = {}) => ({ text: say(key, 'plain', vars, 'terminal') })

const SHOW_CHIP: Record<ChipKind, WordKey | null> = {
  pending: null,
  now: 'step.chip.now',
  started: 'step.chip.started',
  receipts: 'step.chip.checked',
  youChecked: 'step.chip.youChecked',
  claudeSays: 'step.chip.claudeSays',
  untested: 'step.chip.done',
  failed: 'step.chip.failed',
  skipped: 'step.chip.skipped',
  youSkipped: 'step.chip.youSkipped',
  blocked: 'step.chip.blocked',
  claudeDropped: 'step.chip.claudeDropped',
  youRemoved: 'step.chip.youRemoved',
}

// One /flight show line: the mark, the title and the pane's own chip.
function showLine(step: Step, isPlane: boolean): string {
  const word = SHOW_CHIP[chipKindOf(step, isPlane)]
  const mark = isPlane ? '✈' : isClosed(step) ? '✓' : step.status === 'removed' ? 'x' : 'o'

  return say('cmd.show.line', 'plain', { mark, title: step.title, chip: word === null ? step.status : say(word, 'plain', {}, 'terminal') }, 'terminal')
}

// ------------------------------------------------------------ moments

// Steps whose receipts (a test run the map saw pass) are new since `before`.
function freshReceipts(before: Route | null, after: Route) {
  return after.steps.filter(
    step => hasReceipts(step) && step.checkedAt !== undefined && step.checkedAt !== before?.steps.find(one => one.id === step.id)?.checkedAt,
  )
}

// The one-shots a change to the route starts, from the times the model
// persisted, so this agrees with what scene.ts draws: a glide (or U-turn),
// the take-off, a receipts stamp, the landing.
function windowsOf(before: Route | null, after: Route | null): number[] {
  if (after === null) return []
  const out: number[] = []
  if ((after.takeoffAt ?? 0) > (before?.takeoffAt ?? 0)) out.push(ONE_SHOT_MS.takeoff)
  if (after.movedAt > (before?.movedAt ?? 0) && after.landedAt === 0) out.push(ONE_SHOT_MS.glide)
  if (freshReceipts(before, after).length > 0) out.push(ONE_SHOT_MS.stamp)
  if (after.landedAt > 0 && after.landedAt !== before?.landedAt) out.push(landingOf(after) === 'party' ? ONE_SHOT_MS.landingParty : ONE_SHOT_MS.landingQuiet)

  return out
}

// A one-shot lives in the sky only inside its window (R4). Redraw now, and
// once just after each window ends so the next draw drops it; the picture
// never ticks between events.
function redrawAfter($: EngineInterface, windows: readonly number[]) {
  if (windows.length === 0) return
  $.ui.invalidate('ui.render')
  for (const ms of new Set(windows)) $.clock.after(ms + 50, () => $.ui.invalidate('ui.render'))
}

// New receipts tick, or chime when they complete a stop: one sound per
// event, through the limiter. v1's glyph pose (terminal, band) cheers for
// the stamp's window; the sky reads checkedAt itself.
async function cheer($: EngineInterface, before: Route | null, after: Route | null, now: number) {
  if (after === null || freshReceipts(before, after).length === 0) return
  const isStopDone = after.features.some(feature => isStopVerified(after, feature.id) && (before === null || !isStopVerified(before, feature.id)))
  await setLive($, () => ({ celebrateUntil: now + ONE_SHOT_MS.stamp }))
  await play($, isStopDone ? 'chime' : 'tick')
}

// The landing, told honestly (R5): a party (every step tested, the last run
// green) gets the fanfare and "we ate"; a quiet one a chime and what is still
// untested; a failing one no sound, and the failing count.
async function land($: EngineInterface, route: Route) {
  const landing = landingOf(route)
  if (landing === 'party') await play($, 'fanfare')
  if (landing === 'quiet') await play($, 'chime', true)
  toast($, landingWords(route, config.voice, await toastSurface($)).toast)
}

type Helper = Live['helpers'][number]

// A helper's call has returned. One launched in the background is still out
// working: it reports back at the end of its own run, under its agent id
// (turn.complete). One that ran in the foreground is back, or hit a snag (an
// error, or the call was refused). Coming back is never a check.
function helperReturned(helper: Helper, ran: { deny?: string; isError?: boolean; result?: unknown }, now: number): Helper {
  const launched = ran.result as { status?: unknown; agentId?: unknown } | undefined
  const isError = ran.deny !== undefined || ran.isError === true
  if (!isError && (launched?.status === 'async_launched' || launched?.status === 'remote_launched')) {
    return typeof launched.agentId === 'string' ? { ...helper, id: launched.agentId } : helper
  }

  return { ...helper, isDone: true, doneAt: now, isError }
}

// Leaving the gate is the take-off; the sky plays it from takeoffAt.
function leaveGate(route: Route, now: number) {
  route.gate = 'go'
  route.takeoffAt = now
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
// the call that flipped it submits. Take off and the countdown running out
// both land here, so both stamp the take-off.
async function takeOff($: EngineInterface): Promise<boolean> {
  stopCountdown()
  const now = await $.clock.now()
  let isMine = false
  let first = ''
  await update($, routeAtom, current => {
    if (current === null || current.gate === 'go') return current
    isMine = true
    first = current.steps.find(step => step.status === 'pending' || step.status === 'active')?.title ?? ''
    const next: Route = { ...current, gate: 'go', takeoffAt: now }
    return next
  })
  if (!isMine) return false
  await setView($, () => ({ isCountdown: false }))
  await persist($)
  redrawAfter($, [ONE_SHOT_MS.takeoff])
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
  const before = await read($, routeAtom)
  const still = await stillOf($)
  const edit = await mutate($, r => userEdit(r, kind, target, value, now))
  await markChange($, still, now)
  await setView($, view => ({ open: kind === 'rename' ? view.open : null, armedStop: null }))
  if (edit === undefined) return false
  const live = await read($, liveAtom)
  const route = await read($, routeAtom)
  // Skipping the step the plane is on moves it on: the sky glides.
  redrawAfter($, windowsOf(before, route))
  // On the map now; Claude reads it on its next tool result while working,
  // or with the next message while idle. Before takeoff it rides "Go".
  await tell(
    $,
    kind === 'checked'
      ? 'toast.checkedByYou'
      : kind === 'pause'
        ? 'toast.pause.set'
        : route?.gate === 'waiting' || route?.gate === 'held'
          ? 'toast.changed.gate'
          : live?.isRunning
            ? 'toast.changed.flying'
            : 'toast.changed.idle',
  )

  return true
}

async function sendNow($: EngineInterface) {
  const now = await $.clock.now()
  const text = await mutate($, r => deliverEdits(r, now, true))
  if (text === undefined) {
    await tell($, 'toast.nothingToSend')
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
    await tell($, 'toast.stopArm')
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
  await setView($, () => ({ whereAnswer: printable(forked.isAnswered ? forked.text.trim() : `Claude could not answer just now (${forked.reason}).`) }))
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
        const still = await stillOf($)
        const isUndone = await mutate($, r => undoEdit(r, editId))
        await markChange($, still, await $.clock.now())
        await tell($, isUndone ? 'toast.undo.ok' : 'toast.undo.late')
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
          await tell($, 'toast.pause.cancelled')
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
  // The Words setting: a change reloads the module, so it is read once here.
  config.voice = options.voice === 'plain' ? 'plain' : 'fun'
  const { departure, countdownSeconds, isCalm, voice } = config

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
        return reply(isOff ? 'cmd.go.ok' : 'cmd.gate.none')
      }
      case 'hold': {
        const isHeld = await hold($)
        return reply(isHeld ? 'cmd.hold.ok' : 'cmd.gate.none')
      }
      case 'pause': {
        if (route === null || route.landedAt > 0) return reply('cmd.pause.none')
        await editRoute($, 'pause', 'route', '')
        return reply('cmd.pause.ok')
      }
      case 'details': {
        let isOn = false
        await setView($, view => {
          isOn = !view.isDetailsOn
          return { isDetailsOn: isOn }
        })
        return reply(isOn ? 'cmd.details.on' : 'cmd.details.off')
      }
      case 'sound':
        await setView($, () => ({ isSoundOn: rest !== 'off' }))
        return reply(rest === 'off' ? 'cmd.sound.off' : 'cmd.sound.on')
      case 'show': {
        if (route === null) return reply('cmd.show.none')
        const c = counts(route)
        const lines = route.steps.map(step => showLine(step, step.id === route.plane))
        return { text: [say('cmd.show.header', 'plain', { goal: route.goal, done: c.done, total: c.total }), ...lines].join('\n') }
      }
      case 'lab': {
        const opened = await openLab($)
        return { text: opened.isPlaced ? 'Lab opened beside the chat.' : `The lab is open but not on screen yet: ${opened.reason}` }
      }
      default: {
        const opened = await openPane($)
        return opened.isPlaced ? reply('cmd.open.ok') : reply('cmd.open.offscreen', { reason: opened.reason ?? '' })
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
    const still = await stillOf($)
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
    await markChange($, still, now)
    const after = await read($, routeAtom)
    if (wasSet && after !== null) {
      await setView($, () => ({ open: null }))
      void openPane($)
      if (after.gate === 'waiting') await armCountdown($, true)
    }
    // A step start moves the plane at once (and a route that opens the gate
    // takes off); a finish that names a test run the map saw stamps receipts.
    redrawAfter($, windowsOf(before, after))
    await cheer($, before, after, now)

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

    // Strings drawn as Text: a control character would make the engine refuse the pane.
    await setLive($, () => ({
      activity: printable(activityFor(tool, file, command, description)),
      activityAt: now,
      ...(command !== undefined ? { lastCommand: printable(command) } : {}),
    }))

    if (e.tool === 'AskUserQuestion') {
      // `at` times the sky's your-turn pop (scene.ts reads it); Live's type
      // does not list it yet, so it rides along on the object.
      const waiting = { question: printable(e.questions[0]?.question ?? 'a question'), toolUseId: e.tool_use_id, at: now }
      await setLive($, () => ({ waiting }))
      redrawAfter($, [ONE_SHOT_MS.ask])
      await play($, 'knock')
    }
    if (tool === 'Agent' || tool === 'Task') {
      const about = 'description' in e && typeof e.description === 'string' ? printable(e.description) : 'a side task'
      await setLive($, live => ({ helpers: [...live.helpers.filter(one => !one.isDone).slice(-4), { id: e.tool_use_id, description: about, isDone: false, startedAt: now }] }))
    }

    // Leaving the departure gate early: the card collapses, edits still land.
    if (isWrite && route !== null && (route.gate === 'waiting' || route.gate === 'held')) {
      stopCountdown()
      await mutate($, r => leaveGate(r, now))
      await setView($, () => ({ isCountdown: false }))
      redrawAfter($, [ONE_SHOT_MS.takeoff])
    }

    const ran = await next(e)
    const isDenied = ran.deny !== undefined
    const isError = isDenied || ran.isError === true
    const finished = await $.clock.now()

    if (e.tool === 'AskUserQuestion') {
      const still = await stillOf($)
      await setLive($, () => ({ waiting: null }))
      await markChange($, still, finished)
    }
    if (tool === 'Agent' || tool === 'Task') await setLive($, live => ({ helpers: live.helpers.map(one => (one.id === e.tool_use_id ? helperReturned(one, ran, finished) : one)) }))
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
      const before = route
      const still = await stillOf($)
      if (isWrite && !isError) {
        const seen = await mutate($, r => seeWrite(r, file, finished))
        if (seen?.kind === 'step' && seen.moved) await setLive($, () => ({ failedRuns: 0 }))
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
        await mutate($, r => seeTestRun(r, command, summary, finished))
        if (summary.isOk === false) await setLive($, live => ({ failedRuns: live.failedRuns + 1 }))
        if (summary.isOk === true) await setLive($, () => ({ failedRuns: 0 }))
        // The third failing run in a row rolls the storm in (the card's turbulence).
        const live = await read($, liveAtom)
        if (summary.isOk === false && live?.isRunning === true && live.failedRuns === 3) redrawAfter($, [ONE_SHOT_MS.storm])
        const open = route.steps.filter(step => step.status === 'active' || step.status === 'done')
        if (summary.isOk === true && open.length > 0 && !nudged.has('tests')) {
          nudged.add('tests')
          context.push('Flight Plan: the checks ran. Before you reply, close the steps this run covered with one route step call (finish takes several ids; evidence: this run).')
        }
      }
      // A write that moved the plane glides it; a run the map saw pass stamps
      // the steps it covered, with a tick (or a chime for a whole stop).
      await markChange($, still, finished)
      const after = await read($, routeAtom)
      redrawAfter($, windowsOf(before, after))
      await cheer($, before, after, finished)
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
        // A Go typed (or sent) by hand is a take-off too.
        stopCountdown()
        const now = await $.clock.now()
        await mutate($, r => leaveGate(r, now))
        await setView($, () => ({ isCountdown: false }))
        redrawAfter($, [ONE_SHOT_MS.takeoff])
      } else if (route.gate === 'waiting') {
        // Anything else said at the gate holds it: the person is talking.
        await hold($)
      }
      route = await read($, routeAtom)
    }
    // Queued changes ride this prompt down: context added after `next` has
    // resolved is never attached (the prompt has entered). A prompt that does
    // not go through hands them back, still queued for the next one.
    const now = await $.clock.now()
    const edits = route === null ? [] : clone(route.edits)
    const delivered = await mutate($, r => deliverEdits(r, now))
    const context = [...(e.context ?? []), promptNote(route), ...(delivered === undefined ? [] : [delivered])]
    const submitted = await next({ ...e, context })
    if (submitted.drop !== undefined && delivered !== undefined) {
      await mutate($, r => {
        r.edits = r.edits.map(edit => edits.find(one => one.id === edit.id) ?? edit)
      })
    }

    return submitted
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    turnWrites = 0
    nudged.clear()
    // A landing kept its crew on the field; a new turn starts with none.
    await setLive($, () => ({ isRunning: true, turnId: e.turnId, turnStartedAt: now, errorsInRow: 0, failedRuns: 0, activity: 'thinking', activityAt: now, helpers: [] }))
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
    const now = await $.clock.now()
    if (e.agentId !== undefined) {
      // A helper sent off in the background has reported back.
      const live = await read($, liveAtom)
      if (live?.helpers.some(one => one.id === e.agentId && !one.isDone) === true) {
        const isError = e.reason === 'error' || e.reason === 'refusal'
        await setLive($, current => ({ helpers: current.helpers.map(one => (one.id === e.agentId ? { ...one, isDone: true, doneAt: now, isError } : one)) }))
      }
      return ran
    }
    const before = await read($, routeAtom)
    const still = await stillOf($)
    const landed = await mutate($, r => reconcile(r, now))
    const usage = await $.session.usage().catch(() => undefined)
    // The crew stay out for the landing (they cheer at a party); otherwise
    // they are cleared with the turn.
    await setLive($, current => ({
      isRunning: false,
      waiting: null,
      activity: '',
      activityAt: now,
      helpers: landed?.hasLanded === true ? current.helpers : [],
      cost: usage?.cost?.usd ?? null,
      contextPercent: usage?.context.percent ?? null,
    }))
    await markChange($, still, now)
    await debugLog($)
    const route = await read($, routeAtom)
    if (route?.gate === 'waiting') await armCountdown($, false)
    redrawAfter($, windowsOf(before, route))
    if (landed?.hasLanded === true && route !== null) await land($, route)
    else if (landed !== undefined && landed.blocked > 0 && landed.open.length === landed.blocked) {
      await tell($, 'toast.blockedLeft', { n: landed.blocked })
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
          <Text bold>{route?.goal ?? say('pane.title', voice)}</Text>
          <Text dimColor>{c === null ? say('mobile.none', voice) : say('mobile.count', voice, { done: c.done, total: c.total })}</Text>
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
      { route, live, view, now, columns: e.props.bodyColumns, isCompact: e.props.placement === 'inline', isCalm, voice, surface: e.surface },
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
      { route, live, view, now, columns: e.props.bodyColumns, isCompact: true, isCalm, voice, surface: e.surface },
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

    return next({ ...e, props: { ...e.props, message: say('spinner.step', voice, { n: c.position, total: c.total, title: step.title }, e.surface) } })
  })
}
