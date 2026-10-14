import type { Decision, Edit, EditKind, Feature, Route, Step, StepStatus } from '../types'

// The route as plain data and the pure moves on it: what Claude files and
// reports, what the person changes on the map, and what the map sees happen.
// No `$` here, so every rule is tested directly.

// A test run is a test runner at command position (the start, or after
// && ; ||), not any command that mentions one: `npm install -D jest` and
// `git commit -m "add jest tests"` are not test runs.
const RUNNERS =
  '(?:node\\s+--test|node\\s+\\S*\\.test\\.[cm]?[jt]s|(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?test\\b|bun\\s+test|pytest|python3?\\s+-m\\s+(?:pytest|unittest)|npx\\s+(?:jest|vitest|mocha)|jest|vitest|mocha|go\\s+test|cargo\\s+test|claude\\s+plugin\\s+test)'
export const TEST_RUN = new RegExp(`(?:^|&&|\\|\\||;|\\n)\\s*(?:[A-Z_]+=\\S+\\s+)*${RUNNERS}(?![\\w-])`)

// Text inside quotes and heredoc bodies is data, not a command to run.
export function isTestCommand(command: string) {
  const code = command.split(/<<-?\s*['"]?\w+['"]?/)[0] ?? ''

  return TEST_RUN.test(code.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""'))
}

export const basename = (path: string) => path.split('/').pop() ?? path

const LIVE = (step: Step) => step.status !== 'removed'
export const isClosed = (step: Step) => step.status === 'done' || step.status === 'checked' || step.status === 'skipped'
const isOpen = (step: Step) => step.status === 'pending' || step.status === 'active' || step.status === 'failed' || step.status === 'blocked'
export const isSkippedByYou = (step: Step) => step.status === 'skipped' && step.doneBy === 'you'

export type Answer = { result: Record<string, unknown>; context: string[] }

export function newRoute(now: number): Route {
  return {
    version: 0,
    goal: '',
    features: [],
    steps: [],
    decisions: [],
    edits: [],
    plane: null,
    doing: '',
    movedAt: 0,
    setAt: now,
    lastClaudeAt: now,
    gate: 'go',
    isPaused: false,
    landedAt: 0,
    addedAt: 0,
    addedCount: 0,
    nextEdit: 1,
    tests: null,
    files: [],
  }
}

const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const list = (value: unknown) => (Array.isArray(value) ? value : [])
const ids = (value: unknown) => (typeof value === 'string' ? [value] : list(value).filter((one): one is string => typeof one === 'string'))
const indexOf = (route: Route, id: string | null) => (id === null ? -1 : route.steps.findIndex(step => step.id === id))
const stepOf = (route: Route, id: string) => route.steps.find(step => step.id === id)
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// A declared path with a directory matches only that path (or a path ending
// in it); a bare file name matches any path with that name.
export function matchesFile(declared: string, path: string) {
  if (declared.includes('/')) {
    const tail = declared.replace(/^\.\//, '')

    return path === declared || path.endsWith(`/${tail}`)
  }

  return basename(path) === declared
}

function allWritten(step: Step) {
  return step.files.length > 0 && step.files.every(file => step.written.includes(file))
}

export function counts(route: Route) {
  const live = route.steps.filter(LIVE)
  const done = live.filter(isClosed).length
  const checked = live.filter(step => step.status === 'checked').length
  const blocked = live.filter(step => step.status === 'blocked').length
  const position = route.plane === null ? 0 : live.findIndex(step => step.id === route.plane) + 1

  return { total: live.length, done, checked, blocked, left: live.length - done, position }
}

export function featureSteps(route: Route, featureId: string) {
  return route.steps.filter(step => step.featureId === featureId)
}

function nextOpen(route: Route, after: string | null) {
  const from = indexOf(route, after)

  return route.steps.slice(from + 1).find(step => step.status === 'pending' || step.status === 'active') ?? route.steps.find(step => step.status === 'pending' || step.status === 'active')
}

// A landed route reopens when there is new work on it.
function reopen(route: Route) {
  if (route.landedAt === 0) return
  route.landedAt = 0
  route.plane = route.plane ?? nextOpen(route, null)?.id ?? null
}

// ---------------------------------------------------------------- set

export type SetOptions = { departure: 'countdown' | 'go' | 'auto'; countdownSeconds: number; isApproved: boolean }

export function applySet(previous: Route | null, input: Record<string, unknown>, now: number, options: SetOptions): { route: Route; answer: Answer } {
  const seen = new Set<string>()
  const unique = (id: string, fallback: string) => {
    let next = id === '' ? fallback : id
    while (seen.has(next)) next = `${next}x`
    seen.add(next)

    return next
  }
  const features: Feature[] = []
  const steps: Step[] = []
  list(input.features).forEach((raw, featureIndex) => {
    const feature = (raw ?? {}) as Record<string, unknown>
    const featureId = unique(text(feature.id, 40), `f${featureIndex + 1}`)
    features.push({ id: featureId, title: text(feature.title, 80) || `Waypoint ${featureIndex + 1}`, why: text(feature.why, 140) })
    list(feature.steps).forEach((rawStep, stepIndex) => {
      const step = (rawStep ?? {}) as Record<string, unknown>
      steps.push({
        id: unique(text(step.id, 40), `s${steps.length + 1}`),
        featureId,
        title: text(step.title, 80) || `Step ${stepIndex + 1}`,
        why: text(step.why, 140),
        files: ids(step.files).map(file => file.slice(0, 300)).slice(0, 20),
        check: text(step.check, 160),
        status: 'pending',
        written: [],
      })
    })
  })

  if (steps.length === 0) {
    return {
      route: previous ?? newRoute(now),
      answer: { result: { ok: false, error: 'set needs at least one feature with at least one step', version: previous?.version ?? 0 }, context: [] },
    }
  }

  const isReplace = previous !== null && previous.landedAt === 0 && previous.steps.length > 0
  const route: Route = isReplace ? { ...previous } : newRoute(now)
  if (isReplace) {
    // A re-filed route keeps what already happened, but only for a step that
    // is recognisably the same one (same title, or overlapping files): a
    // renumbered route must not turn Claude's new step into an old one.
    const removedByYou = previous.steps.filter(step => step.status === 'removed' && step.removedBy === 'you')
    for (const step of steps) {
      const before = previous.steps.find(
        one => one.id === step.id && (same(one.title, step.title) || one.files.some(file => step.files.includes(file)) || hasUserTitle(previous, one.id)),
      )
      if (before !== undefined) {
        step.status = before.status
        step.written = before.written.filter(file => step.files.includes(file))
        step.doneBy = before.doneBy
        step.claim = before.claim
        step.removedBy = before.removedBy
        if (hasUserTitle(previous, before.id)) step.title = before.title
      }
      if (removedByYou.some(one => same(one.title, step.title))) {
        step.status = 'removed'
        step.removedBy = 'you'
      }
    }
    // Waypoints the person renamed keep their wording; ones they proposed
    // stay on the map until Claude plans them.
    for (const feature of features) {
      const old = previous.features.find(one => one.id === feature.id)
      if (old !== undefined && hasUserTitle(previous, old.id)) feature.title = old.title
    }
    for (const proposed of previous.features.filter(one => one.proposedBy === 'you')) {
      if (features.some(feature => same(feature.title, proposed.title))) ackByTarget(previous, proposed.id, now)
      else features.push(proposed)
    }
    route.addedCount = Math.max(0, steps.filter(LIVE).length - previous.steps.filter(LIVE).length)
    route.addedAt = route.addedCount > 0 ? now : previous.addedAt
    route.decisions = previous.decisions.map(decision =>
      features.some(feature => feature.id === decision.afterFeature) ? decision : { ...decision, afterFeature: features[features.length - 1]?.id ?? '' },
    )
  }
  ackEdits(route, ids(input.acks), now, false)
  route.goal = text(input.goal, 120) || route.goal || features[0]?.title || 'This task'
  route.features = features
  route.steps = steps
  route.version += 1
  route.lastClaudeAt = now
  if (!isReplace) route.setAt = now
  if (route.plane !== null && stepOf(route, route.plane) === undefined) route.plane = null

  const missingFiles = steps.filter(step => step.files.length === 0 && step.check === '')
  const isSmall = steps.length <= 3
  // Re-filing never overrides the person: a route held at the gate stays held.
  route.gate = isReplace
    ? previous.gate
    : options.isApproved || isSmall || options.departure === 'auto'
      ? 'go'
      : 'waiting'
  const first = steps.find(step => step.status === 'pending' || step.status === 'active')
  const context: string[] = []
  if (route.gate === 'waiting' || route.gate === 'held') {
    context.push(
      options.departure === 'countdown' && route.gate === 'waiting'
        ? `The user reviews the route on the Flight Plan map before you start. Reply with one short line saying the route is on the map and you take off in ${options.countdownSeconds} seconds unless they hold, then end your turn. Do not edit files until a message says Go.`
        : 'The user reviews the route on the Flight Plan map before you start. Reply with one short line saying the route is on the map and you start when they press Take off, then end your turn. Do not edit files until a message says Go.',
    )
  } else if (first !== undefined && !isReplace) {
    context.push(`Start now with ${first.id} "${first.title}". The map follows your writes to each step's files; call step to finish steps with evidence as you go.`)
  }
  if (missingFiles.length > 0) {
    context.push(
      `${missingFiles.map(step => step.id).join(', ')} name no files and no check, so the map cannot follow them; add them with patch reword when you know.`,
    )
  }

  return {
    route,
    answer: {
      result: {
        ok: true,
        version: route.version,
        summary: `${steps.length} steps under ${features.length} waypoints`,
        gate: route.gate,
        ...(isReplace ? { kept: "statuses of unchanged steps, and the user's removals and wording, carried over" } : {}),
      },
      context,
    },
  }
}

function hasUserTitle(route: Route, id: string) {
  return route.edits.some(edit => edit.kind === 'rename' && edit.target === id)
}

// ---------------------------------------------------------------- step

export function applyStep(route: Route, input: Record<string, unknown>, now: number): Answer {
  const context: string[] = []
  ackEdits(route, ids(input.acks), now, true)
  const outcome = input.outcome === 'skipped' || input.outcome === 'blocked' ? input.outcome : 'done'
  const evidence = text(input.evidence, 160)
  // Claude's "done" counts as checked when it names a test run the map saw pass.
  const isSeenPass = route.tests !== null && route.tests.failed === 0 && route.tests.passed > 0 && isTestCommand(evidence.split(':')[0] ?? '')
  const finished: { id: string; title: string; status: StepStatus }[] = []
  const refused: string[] = []

  for (const id of ids(input.finish)) {
    const step = stepOf(route, id)
    if (step === undefined) continue
    if (step.status === 'removed' || isSkippedByYou(step)) {
      refused.push(`${id} "${step.title}" (${step.status === 'removed' ? 'removed' : 'skipped'} by the user)`)
      continue
    }
    if (outcome === 'skipped') step.status = 'skipped'
    else if (outcome === 'blocked') step.status = 'blocked'
    else if (step.status !== 'checked') step.status = isSeenPass && isTestCommand(step.check) ? 'checked' : 'done'
    if (outcome === 'done') {
      step.doneBy = step.doneBy === 'seen' ? 'seen' : 'claude'
      step.claim = evidence || 'none'
    }
    step.note = text(input.note, 160) || step.note
    finished.push({ id: step.id, title: step.title, status: step.status })
  }
  if (refused.length > 0) context.push(`Not changed: ${refused.join('; ')}.`)

  if (typeof input.start === 'string' && input.start !== '') {
    const step = stepOf(route, input.start)
    if (step === undefined) {
      return { result: { ok: false, error: `no step ${input.start}; call get to see the route`, version: route.version }, context }
    }
    if (step.status === 'removed' || isSkippedByYou(step)) {
      const next = route.steps.find(one => (one.status === 'pending' || one.status === 'active') && one.id !== step.id)

      return {
        result: {
          ok: false,
          error: `"${step.title}" was ${step.status === 'removed' ? 'removed' : 'skipped'} by the user; next open: ${next === undefined ? 'none' : `${next.id} "${next.title}"`}`,
          version: route.version,
        },
        context,
      }
    }
    if (step.status !== 'active') step.status = 'active'
    reopen(route)
    moveTo(route, step.id, now, 'claude')
  }
  route.doing = text(input.doing, 80) || route.doing
  route.lastClaudeAt = now
  route.version += 1

  const next = route.steps.find(step => step.status === 'pending')

  return {
    result: {
      ok: true,
      version: route.version,
      ...(finished.length > 0 ? { finished } : {}),
      ...(route.plane !== null ? { on: route.plane } : {}),
      ...(next !== undefined ? { next: { id: next.id, title: next.title } } : {}),
      left: counts(route).left,
    },
    context,
  }
}

// The plane goes where Claude says, unless that would carry it back over
// open work the map saw happen on a later step. A redo, a failed step, or a
// move back over steps that are all closed is allowed.
function moveTo(route: Route, id: string, now: number, by: 'claude' | 'seen') {
  const to = indexOf(route, id)
  const from = indexOf(route, route.plane)
  if (to === from) return
  if (by === 'claude' && to < from) {
    const target = route.steps[to]
    const isRework = target?.note === 'you asked for a redo' || target?.status === 'failed'
    const between = route.steps.slice(to + 1, from + 1)
    const hasOpenWork = between.some(step => step.written.length > 0 && !isClosed(step))
    if (!isRework && hasOpenWork) return
  }
  route.plane = id
  route.movedAt = now
}

// ---------------------------------------------------------------- patch, decide, get

export function applyPatch(route: Route, input: Record<string, unknown>, now: number): Answer {
  ackEdits(route, ids(input.acks), now, true)
  const applied: string[] = []
  const rejected: { op: string; id: string; reason: string }[] = []

  for (const raw of list(input.add)) {
    const add = (raw ?? {}) as Record<string, unknown>
    let featureId = text(add.feature, 40)
    if (!route.features.some(feature => feature.id === featureId)) {
      const title = text(add.featureTitle, 80)
      const proposed = route.features.find(feature => feature.proposedBy === 'you' && title !== '' && same(feature.title, title))
      if (proposed !== undefined) {
        featureId = proposed.id
        delete proposed.proposedBy
        ackByTarget(route, proposed.id, now)
      } else {
        featureId = featureId || `f${route.features.length + 1}`
        route.features.push({ id: featureId, title: title || 'New waypoint', why: '' })
      }
    } else {
      const proposed = route.features.find(feature => feature.id === featureId && feature.proposedBy === 'you')
      if (proposed !== undefined) {
        delete proposed.proposedBy
        ackByTarget(route, proposed.id, now)
      }
    }
    let id = text(add.id, 40) || `s${route.steps.length + 1}`
    while (stepOf(route, id) !== undefined) id = `${id}x`
    const step: Step = {
      id,
      featureId,
      title: text(add.title, 80) || 'New step',
      why: text(add.why, 140),
      files: ids(add.files).slice(0, 20),
      check: text(add.check, 160),
      status: 'pending',
      written: [],
    }
    const after = indexOf(route, text(add.after, 40))
    const lastOfFeature = route.steps.map(one => one.featureId).lastIndexOf(featureId)
    const at = after >= 0 ? after + 1 : lastOfFeature >= 0 ? lastOfFeature + 1 : route.steps.length
    route.steps.splice(at, 0, step)
    applied.push(`add ${id}`)
  }
  if (list(input.add).length > 0) {
    route.addedCount = list(input.add).length
    route.addedAt = now
    reopen(route)
  }

  for (const id of ids(input.drop)) {
    const step = stepOf(route, id)
    if (step === undefined) rejected.push({ op: 'drop', id, reason: 'no such step' })
    else if (isClosed(step) || step.status === 'active') rejected.push({ op: 'drop', id, reason: 'already done or in progress' })
    else if (route.edits.some(edit => edit.target === id && edit.kind !== 'remove')) rejected.push({ op: 'drop', id, reason: 'the user changed this step; ask them first' })
    else {
      step.status = 'removed'
      step.removedBy = 'claude'
      step.note = text(input.note, 160) || 'dropped by Claude'
      applied.push(`drop ${id}`)
    }
  }

  for (const raw of list(input.reword)) {
    const change = (raw ?? {}) as Record<string, unknown>
    const step = stepOf(route, text(change.id, 40))
    if (step === undefined) {
      rejected.push({ op: 'reword', id: text(change.id, 40), reason: 'no such step' })
      continue
    }
    if (typeof change.title === 'string' && hasUserTitle(route, step.id)) {
      rejected.push({ op: 'reword', id: step.id, reason: `the user named this step "${step.title}"; their wording stands` })
    } else if (typeof change.title === 'string') step.title = text(change.title, 80)
    if (typeof change.why === 'string') step.why = text(change.why, 140)
    if (Array.isArray(change.files)) step.files = ids(change.files).slice(0, 20)
    if (typeof change.check === 'string') step.check = text(change.check, 160)
    applied.push(`reword ${step.id}`)
  }

  const order = ids(input.order)
  if (order.length > 0) {
    const pending = route.steps.filter(step => step.status === 'pending')
    const byId = new Map(pending.map(step => [step.id, step]))
    const ordered = order.map(id => byId.get(id)).filter((step): step is Step => step !== undefined)
    const rest = pending.filter(step => !order.includes(step.id))
    const queue = [...ordered, ...rest]
    route.steps = route.steps.map(step => (step.status === 'pending' ? (queue.shift() ?? step) : step))
    applied.push('order')
  }

  route.version += 1
  route.lastClaudeAt = now
  const context = rejected.length > 0 ? [`Not applied: ${rejected.map(one => `${one.op} ${one.id} (${one.reason})`).join('; ')}.`] : []

  return { result: { ok: true, version: route.version, applied, rejected }, context }
}

export function applyDecide(route: Route, input: Record<string, unknown>, now: number): Answer {
  ackEdits(route, ids(input.acks), now, true)
  const id = text(input.id, 40) || `d${route.decisions.length + 1}`
  const choice = text(input.choice, 80)
  const existing = route.decisions.find(decision => decision.id === id)
  const isUsers = existing?.userChoice !== undefined && (existing.state === 'switched' || existing.state === 'yours')
  if (isUsers && existing?.userChoice !== undefined && !same(choice, existing.userChoice)) {
    return {
      result: { ok: false, error: `the user chose "${existing.userChoice}" for this; their choice stands`, version: route.version },
      context: [`Use "${existing.userChoice}" as the user chose, and rework the steps it affects.`],
    }
  }
  const planeFeature = stepOf(route, route.plane ?? '')?.featureId ?? route.features[route.features.length - 1]?.id ?? ''
  const decision: Decision = {
    id,
    question: text(input.question, 100) || existing?.question || 'A choice',
    choice: choice || existing?.choice || '',
    alternatives: ids(input.alternatives).length > 0 ? ids(input.alternatives).map(one => one.slice(0, 80)).slice(0, 3) : (existing?.alternatives ?? []),
    why: text(input.why, 140) || existing?.why || '',
    affects: ids(input.affects).length > 0 ? ids(input.affects) : (existing?.affects ?? []),
    afterFeature: existing?.afterFeature ?? planeFeature,
    state: isUsers ? 'yours' : existing?.state === 'kept' ? 'kept' : 'flagged',
    ...(existing?.userChoice !== undefined ? { userChoice: existing.userChoice } : {}),
  }
  route.decisions = existing === undefined ? [...route.decisions, decision] : route.decisions.map(one => (one.id === id ? decision : one))
  route.version += 1
  route.lastClaudeAt = now

  return {
    result: { ok: true, version: route.version, id, flagged: decision.state === 'flagged' },
    context: decision.state === 'flagged' ? ['Recorded on the map for the user to review; keep going.'] : [],
  }
}

export function routeView(route: Route): Record<string, unknown> {
  return {
    ok: true,
    version: route.version,
    goal: route.goal,
    on: route.plane,
    steps: route.steps.map(step => [step.id, step.featureId, step.title, step.status]),
    decisions: route.decisions.map(decision => [decision.id, decision.question, decision.userChoice ?? decision.choice, decision.state]),
    userEdits: route.edits.filter(edit => edit.state !== 'acked').map(edit => ({ id: edit.id, kind: edit.kind, target: edit.target, text: edit.text })),
  }
}

// ---------------------------------------------------------------- the person's edits

// When the plane's own step is removed or skipped, the plane moves on.
function movePlaneOff(route: Route, id: string, now: number) {
  if (route.plane !== id) return
  route.plane = nextOpen(route, id)?.id ?? null
  route.movedAt = now
}

// An edit lands on the map at once (the person's version wins) and waits as
// `queued` until a channel hands it to Claude.
export function userEdit(route: Route, kind: EditKind, target: string, value: string, now: number): Edit | undefined {
  const step = stepOf(route, target)
  const feature = route.features.find(one => one.id === target)
  const decision = route.decisions.find(one => one.id === target)
  const snapshot = (fields: Record<string, unknown>) => JSON.stringify({ ...fields, plane: route.plane })
  let before = ''
  let summary = ''

  switch (kind) {
    case 'rename': {
      const node = step ?? feature
      if (node === undefined || value.trim() === '' || value.trim() === node.title) return undefined
      before = snapshot({ title: node.title })
      node.title = value.trim().slice(0, 80)
      summary = `renamed ${step !== undefined ? 'step' : 'waypoint'} ${target} from "${JSON.parse(before).title}" to "${node.title}"`
      break
    }
    case 'skip': {
      if (step === undefined) return undefined
      before = snapshot({ status: step.status, doneBy: step.doneBy })
      step.status = 'skipped'
      step.doneBy = 'you'
      summary =
        route.plane === target
          ? `skipped step ${target} "${step.title}", the one you are on: stop working on it now and move to the next step`
          : `skipped step ${target} "${step.title}": do not do it`
      movePlaneOff(route, target, now)
      break
    }
    case 'remove': {
      if (step !== undefined) {
        before = snapshot({ status: step.status, removedBy: step.removedBy })
        step.status = 'removed'
        step.removedBy = 'you'
        summary = `removed step ${target} "${step.title}": do not implement it`
        movePlaneOff(route, target, now)
      } else if (feature !== undefined) {
        before = snapshot({ steps: featureSteps(route, target).map(one => [one.id, one.status, one.removedBy ?? '']) })
        for (const one of featureSteps(route, target)) {
          if (isClosed(one)) continue
          one.status = 'removed'
          one.removedBy = 'you'
          movePlaneOff(route, one.id, now)
        }
        summary = `removed waypoint ${target} "${feature.title}" and its unfinished steps: do not implement them`
      } else return undefined
      break
    }
    case 'redo': {
      if (step === undefined) return undefined
      before = snapshot({ status: step.status, note: step.note ?? '' })
      step.status = 'pending'
      step.note = 'you asked for a redo'
      summary = `asked to redo step ${target} "${step.title}"${value === '' ? '' : `: ${value}`}`
      reopen(route)
      break
    }
    case 'checked': {
      if (step === undefined) return undefined
      before = snapshot({ status: step.status, doneBy: step.doneBy })
      step.status = 'checked'
      step.doneBy = 'you'
      summary = `checked step ${target} "${step.title}" themselves: it works`
      break
    }
    case 'switch': {
      if (decision === undefined) return undefined
      before = snapshot({ state: decision.state, userChoice: decision.userChoice ?? null })
      decision.state = 'switched'
      decision.userChoice = value
      summary = `switched decision ${target} "${decision.question}" from "${decision.choice}" to "${value}"; ${impactText(route, decision)}`
      break
    }
    case 'add-feature': {
      if (value.trim() === '') return undefined
      const id = `u${route.nextEdit}`
      route.features.push({ id, title: value.trim().slice(0, 80), why: '(Claude will plan this)', proposedBy: 'you' })
      summary = `added a waypoint "${value.trim()}" at the end: plan its steps with patch add (featureTitle "${value.trim()}")`
      target = id
      reopen(route)
      break
    }
    case 'pause': {
      route.isPaused = true
      summary = 'asked to pause: finish the step you are on, update the map with step, then end your turn with a two-line summary'
      break
    }
    case 'nudge':
    case 'note': {
      summary = value
      break
    }
  }

  const queued = route.edits.find(edit => edit.state === 'queued' && edit.kind === kind && edit.target === target)
  const edit: Edit = queued ?? {
    id: `e${route.nextEdit}`,
    kind,
    target,
    text: summary,
    state: 'queued',
    misses: 0,
    isResent: false,
    at: now,
    deliveredAt: 0,
    ackedAt: 0,
    before,
  }
  if (queued !== undefined) queued.text = summary
  else {
    route.edits = [...route.edits, edit]
    route.nextEdit += 1
  }
  route.version += 1

  return edit
}

export function undoEdit(route: Route, editId: string): boolean {
  const edit = route.edits.find(one => one.id === editId)
  if (edit === undefined || edit.state !== 'queued') return false
  const step = stepOf(route, edit.target)
  const feature = route.features.find(one => one.id === edit.target)
  const decision = route.decisions.find(one => one.id === edit.target)
  const was = (edit.before === '' ? {} : JSON.parse(edit.before)) as Record<string, unknown>
  if (edit.kind === 'rename' && typeof was.title === 'string') {
    if (step !== undefined) step.title = was.title
    else if (feature !== undefined) feature.title = was.title
  }
  if ((edit.kind === 'skip' || edit.kind === 'remove' || edit.kind === 'redo' || edit.kind === 'checked') && step !== undefined) {
    step.status = was.status as StepStatus
    if ('doneBy' in was) step.doneBy = was.doneBy as Step['doneBy']
    if ('removedBy' in was) step.removedBy = was.removedBy as Step['removedBy']
    if ('note' in was) step.note = was.note === '' ? undefined : (was.note as string)
  }
  if (edit.kind === 'remove' && feature !== undefined && Array.isArray(was.steps)) {
    for (const [id, status, by] of was.steps as [string, StepStatus, string][]) {
      const one = stepOf(route, id)
      if (one === undefined) continue
      one.status = status
      one.removedBy = by === '' ? undefined : (by as Step['removedBy'])
    }
  }
  if (edit.kind === 'switch' && decision !== undefined) {
    decision.state = (was.state as Decision['state'] | undefined) ?? 'flagged'
    if (typeof was.userChoice === 'string') decision.userChoice = was.userChoice
    else delete decision.userChoice
  }
  if ('plane' in was && (edit.kind === 'skip' || edit.kind === 'remove')) route.plane = (was.plane as string | null) ?? route.plane
  if (edit.kind === 'add-feature') route.features = route.features.filter(one => one.id !== edit.target)
  if (edit.kind === 'pause') route.isPaused = false
  route.edits = route.edits.filter(one => one.id !== editId)
  route.version += 1

  return true
}

export function impactText(route: Route, decision: Decision): string {
  const affected = decision.affects.map(id => stepOf(route, id)).filter((step): step is Step => step !== undefined && step.status !== 'removed')
  if (affected.length === 0) return 'no steps listed as depending on it'
  const parts = affected.map(step => `${isClosed(step) ? 'redo' : step.status === 'active' ? 'change' : 'plan'} "${step.title}"${isClosed(step) ? ' (done)' : step.status === 'active' ? ' (in progress)' : ''}`)

  return `if switched: ${parts.join(', ')}`
}

// Queued edits become one instruction for Claude, and turn `delivered`. An
// edit two route calls ignored is re-sent once; `force` (the person's Send
// now) re-sends every edit Claude has not acknowledged.
export function deliverEdits(route: Route, now: number, force = false): string | undefined {
  const picked = route.edits.filter(
    edit => edit.state === 'queued' || (edit.state === 'delivered' && (force || (edit.misses >= 2 && !edit.isResent))),
  )
  if (picked.length === 0) return undefined
  for (const edit of picked) {
    if (edit.state === 'delivered') {
      edit.isResent = !force
      edit.misses = 0
    }
    edit.state = 'delivered'
    edit.deliveredAt = now
  }
  const urgent = picked.some(edit => edit.kind === 'skip' && edit.text.includes('the one you are on'))
  const lines = picked.map(edit => `${edit.id}: the user ${edit.text}`)

  return `Flight Plan: the user changed the map. ${urgent ? 'Apply these now' : 'Finish what you are doing in the current step, then apply these before starting the next step'}, and echo their ids in acks on your next route call:\n${lines.join('\n')}`
}

// A route call acknowledges what it names; one that names none counts a miss
// on each delivered edit (set does not count misses: a re-file applies edits).
export function ackEdits(route: Route, acks: string[], now: number, countsMiss: boolean) {
  for (const edit of route.edits) {
    if (edit.state === 'acked') continue
    if (acks.includes(edit.id)) {
      edit.state = 'acked'
      edit.ackedAt = now
    } else if (countsMiss && edit.state === 'delivered') edit.misses += 1
  }
}

export const isUnapplied = (edit: Edit) => edit.state === 'delivered' && edit.isResent && edit.misses >= 1

function ackByTarget(route: Route, target: string, now: number) {
  for (const edit of route.edits) {
    if (edit.target === target && edit.state !== 'acked') {
      edit.state = 'acked'
      edit.ackedAt = now
    }
  }
}

// ---------------------------------------------------------------- what the map sees

export type WriteSeen =
  | { kind: 'step'; stepId: string; moved: boolean }
  | { kind: 'removed'; title: string }
  | { kind: 'skipped'; title: string }
  | { kind: 'unplanned' }

export function ownersOf(route: Route, path: string) {
  return route.steps.filter(step => step.files.some(file => matchesFile(file, path)))
}

export function seeWrite(route: Route, path: string, now: number): WriteSeen {
  const name = basename(path)
  if (!route.files.includes(name)) route.files = [...route.files, name].slice(-200)
  const owners = ownersOf(route, path)
  if (owners.length === 0) return { kind: 'unplanned' }
  for (const step of owners) {
    for (const file of step.files) if (matchesFile(file, path) && !step.written.includes(file)) step.written = [...step.written, file]
  }
  const live = owners.filter(step => LIVE(step) && !isSkippedByYou(step))
  if (live.length === 0) {
    const first = owners[0]

    return first?.status === 'removed' ? { kind: 'removed', title: first.title } : { kind: 'skipped', title: first?.title ?? name }
  }
  const target = live.find(step => !isClosed(step)) ?? live[live.length - 1]
  if (target === undefined) return { kind: 'unplanned' }
  if (target.status !== 'active') target.status = 'active'
  // A shared file closes every other open owner it completes.
  for (const step of live) {
    if (step !== target && (step.status === 'pending' || step.status === 'active') && allWritten(step) && indexOf(route, step.id) < indexOf(route, target.id)) {
      step.status = 'done'
      step.doneBy = 'seen'
    }
  }
  reopen(route)
  const from = indexOf(route, route.plane)
  const to = indexOf(route, target.id)
  let moved = false
  if (to > from) {
    for (const step of route.steps.slice(0, to)) {
      if ((step.status === 'active' || step.status === 'pending') && allWritten(step)) {
        step.status = 'done'
        step.doneBy = 'seen'
      }
    }
    route.plane = target.id
    route.movedAt = now
    moved = true
  }

  return { kind: 'step', stepId: target.id, moved }
}

export type TestSummary = { passed: number; failed: number; isOk: boolean | null }

// Only summary lines count, the last one wins, and a run with no summary is
// unknown (null): it changes no status.
export function readTestOutput(output: string, isError: boolean): TestSummary {
  const last = (pattern: RegExp) => {
    let found: RegExpExecArray | null = null
    for (const match of output.matchAll(pattern)) found = match

    return found
  }
  const counted = (line: string | undefined, word: RegExp) => {
    const match = line?.match(word)

    return match?.[1] === undefined ? 0 : Number(match[1])
  }
  // node --test: "ℹ pass 11" / "# fail 0"
  const nodePass = last(/^\s*(?:ℹ|#)\s*pass\s+(\d+)\s*$/gm)
  const nodeFail = last(/^\s*(?:ℹ|#)\s*fail\s+(\d+)\s*$/gm)
  if (nodePass !== null || nodeFail !== null) {
    const passed = Number(nodePass?.[1] ?? 0)
    const failed = Number(nodeFail?.[1] ?? 0)

    return { passed, failed, isOk: !isError && failed === 0 && passed > 0 }
  }
  // jest "Tests: 1 failed, 14 passed, 15 total"; vitest "Tests  1 failed | 13 passed (14)"
  const tests = last(/^\s*Tests:?\s+(.*)$/gm)?.[1]
  // pytest "==== 3 passed, 1 failed in 0.2s ===="
  const pytest = last(/^=+\s(.*\b(?:passed|failed)\b.*)\s=+$/gm)?.[1]
  // cargo "test result: ok. 9 passed; 0 failed"
  const cargo = last(/^test result: \w+\.\s+(.*)$/gm)?.[1]
  // mocha "14 passing" / "1 failing"; bun and `claude plugin test` " 37 pass" / " 0 fail"
  const mochaPass = last(/^\s*(\d+)\s+pass(?:ing)?\s*(?:\(|$)/gm)
  const mochaFail = last(/^\s*(\d+)\s+fail(?:ing)?\s*(?:\(|$)/gm)
  const line = tests ?? pytest ?? cargo
  if (line !== undefined) {
    const passed = counted(line, /(\d+)\s+passed/)
    const failed = counted(line, /(\d+)\s+failed/)

    return { passed, failed, isOk: !isError && failed === 0 && passed > 0 }
  }
  if (mochaPass !== null || mochaFail !== null) {
    const passed = Number(mochaPass?.[1] ?? 0)
    const failed = Number(mochaFail?.[1] ?? 0)

    return { passed, failed, isOk: !isError && failed === 0 && passed > 0 }
  }
  // go test: "ok  	example.com/pkg	0.012s" and "FAIL	example.com/pkg	0.3s"
  const goLine = /^(?:ok|FAIL)[ \t]+\S+[ \t]+(?:[\d.]+s|\(cached\))/gm
  if (goLine.test(output)) {
    const failed = (output.match(/^FAIL[ \t]+\S+[ \t]+[\d.]+s/gm) ?? []).length
    const passed = (output.match(/^ok[ \t]+\S+[ \t]+(?:[\d.]+s|\(cached\))/gm) ?? []).length

    return { passed, failed, isOk: !isError && failed === 0 && passed > 0 }
  }

  return { passed: 0, failed: 0, isOk: null }
}

// A run checks the steps whose own check is a test run: written steps that
// are complete, and check-only steps once nothing before them is pending.
// Steps checked some other way ("open the page") are not touched by tests.
export function seeTestRun(route: Route, command: string, summary: TestSummary, now: number): string[] {
  if (summary.isOk === null) return []
  route.tests = { passed: summary.passed, failed: summary.failed, at: now, command: command.slice(0, 120) }
  const changed: string[] = []
  route.steps.forEach((step, index) => {
    if (step.status === 'removed' || step.status === 'skipped' || step.status === 'blocked') return
    if (!isTestCommand(step.check)) return
    const isCheckOnly = step.files.length === 0
    const isTouched = step.written.length > 0
    if (!isCheckOnly && !isTouched) return
    if (summary.isOk === true) {
      const isReady = isCheckOnly ? !route.steps.slice(0, index).some(one => one.status === 'pending' && LIVE(one)) : allWritten(step)
      if (isReady && step.status !== 'checked') {
        step.status = 'checked'
        step.doneBy = step.doneBy ?? 'seen'
        changed.push(step.id)
      } else if (!isReady && step.status === 'failed') {
        step.status = 'active'
      }
    } else if (step.status === 'checked' || step.status === 'done') {
      step.status = 'failed'
      changed.push(step.id)
    }
  })

  return changed
}

// At the end of a turn: a step whose files were all written is done as far
// as the map saw; when every live step is closed, nothing is blocked and
// nothing the person added waits to be planned, the flight has landed.
export function reconcile(route: Route, now: number): { open: Step[]; hasLanded: boolean; blocked: number } {
  for (const step of route.steps) {
    if ((step.status === 'active' || step.status === 'pending') && allWritten(step)) {
      step.status = 'done'
      step.doneBy = step.doneBy ?? 'seen'
    }
  }
  // One-shot requests end with the turn.
  for (const edit of route.edits) {
    if ((edit.kind === 'pause' || edit.kind === 'nudge') && edit.state !== 'acked') {
      edit.state = 'acked'
      edit.ackedAt = now
    }
  }
  const live = route.steps.filter(LIVE)
  const open = live.filter(step => !isClosed(step))
  const blocked = live.filter(step => step.status === 'blocked').length
  const isWaiting =
    route.features.some(feature => feature.proposedBy === 'you') ||
    route.edits.some(edit => (edit.kind === 'redo' || edit.kind === 'add-feature') && edit.state !== 'acked')
  const hasLanded = live.length > 0 && open.length === 0 && !isWaiting && route.landedAt === 0
  if (hasLanded) {
    route.landedAt = Math.max(1, now)
    route.plane = null
  }

  return { open, hasLanded, blocked }
}

export function promptNote(route: Route | null): string {
  const head =
    'Flight Plan is on: the user follows this task on a live map beside the chat. For work with two or more steps, file it with mcp__flightplan__route op set (each step with the files it will touch and its check) before your first edit, then report with op step as steps finish (finish takes several ids). Close finished steps before you reply.'
  if (route === null || route.landedAt > 0 || route.steps.length === 0) return head
  if (route.gate === 'waiting' || route.gate === 'held') {
    return `${head} Map now: "${route.goal}" is waiting at the gate for the user to press Take off; do not edit files until a message says Go.`
  }
  const where = counts(route)
  const step = stepOf(route, route.plane ?? '')

  return step === undefined
    ? `${head} Map now: "${route.goal}", ${where.done} of ${where.total} steps done.`
    : `${head} Map now: "${route.goal}", step ${where.position} of ${where.total} in progress (${step.id} "${step.title}"), ${where.done} done.`
}
