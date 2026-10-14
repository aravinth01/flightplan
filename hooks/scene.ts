import type { Feature, Live, Route, Step } from '../types'
import {
  AMBER,
  ASPHALT,
  BADGE,
  BASE,
  BOLT,
  BOLT_PALETTE,
  CAPTAIN,
  CAPTAIN_WAVE,
  CLIPBOARD,
  CLIPBOARD_AT,
  CLOUD_BIG,
  CLOUD_SMALL,
  CONFETTI_COLORS,
  CREAM,
  CREW_CHEER,
  CREW_STAND,
  CREW_WALK,
  DUSK_INK,
  FLAG,
  FLAG_TIP,
  GEAR,
  GEAR_AT,
  INK,
  LAMP,
  MINI_DONE,
  MINI_FAILED,
  MINI_FLAG,
  MINI_PIN,
  MINI_TIP,
  MUG,
  MUG_AT,
  ORANGE,
  OUTFITS,
  PAINT,
  PAUSE,
  PILOT,
  PILOT_AT,
  PIN,
  PIN_CURRENT,
  PIN_DONE,
  PIN_FAILED,
  PIN_PENDING,
  PIN_PROPOSED,
  PIN_TIP,
  PIN_YOURS,
  PLANE,
  PLUS,
  PROP_AT,
  PROP_BLUR,
  PROP_EDGE,
  PROP_FULL,
  PUFFS,
  PUFFS_AT,
  QUESTION,
  QUESTION_SMALL,
  RAIN,
  RED,
  SIGNPOST,
  SKIES,
  SPARKLE,
  STEAM,
  STEAM_AT,
  STORM_CLOUD,
  STORM_PALETTE,
  SUN_BODY,
  SUN_RAYS_A,
  SUN_RAYS_B,
  TAIL_LIGHT,
  TOWER,
  TOWER_PALETTE,
  WARNING,
  WHITE,
} from './art'
import type { Sky } from './art'
import { counts, hasReceipts, isClosed, isStopVerified, landingOf } from './model'
import type { Landing } from './model'
import { esc, sprite, toPaths } from './pixels'
import type { Grid, Palette } from './pixels'

// The pixel sky: a tiny 8-bit airfield drawn from the route, the live state
// and the pane width. Pure: sceneKey() reduces the state to a plain key with
// no timestamps, sceneSvg() draws the key (memoized, byte-stable), and the
// one-shots (glide, take-off, receipts stamp, landing) live in the key only
// inside their windows, from times the model persisted. Nothing here reads
// a clock: `now` is passed in, and used only to ask "is this window open?".

// ---------------------------------------------------------------- types

// Scene poses, from state only (R10):
// - empty: no route yet. ground: held at the gate. boarding: at the gate,
//   waiting (countdown or Take off). ask: Claude asked you something (at the
//   gate before take-off, circling after). air: flying. chop: a failed test
//   run or two on this step (a wobble, no words). storm: 3 or more in a row.
//   holding: the turn ended with steps open. paused: you paused it.
export type ScenePose = 'empty' | 'ground' | 'boarding' | 'air' | 'ask' | 'holding' | 'paused' | 'chop' | 'storm' | 'landed'
export type SkyBucket = 'predawn' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'golden' | 'dusk'

// How a stop's pin looks: verified = every step has receipts (green flag).
export type PinState = 'pending' | 'current' | 'done' | 'verified' | 'failed' | 'yours'

// A move that plays once: a glide between steps (a U-turn back for a redo),
// the take-off from the gate, or the landing.
export type SceneMove = { kind: 'glide'; fromX: number; isUturn: boolean } | { kind: 'takeoff' } | { kind: 'landing'; fromX: number }

export type SceneKey = {
  W: number
  H: number
  scale: number
  isStrip: boolean
  isCalm: boolean
  pose: ScenePose
  /** The plane is parked at the gate (held, boarding, or a question before take-off). */
  atGate: boolean
  /** Sky clock minutes (R2): moves only when steps close. */
  minutes: number
  bucket: SkyBucket
  pins: { state: PinState; sign: string; tip: string }[]
  /** How far along the route the plane is, in art units: x0 at the gate, x1 once landed. */
  planeX: number
  crew: { variant: number; isBack: boolean }[]
  extraCrew: number
  landing: Landing | null
  move: SceneMove | null
  /** The stop whose step just got receipts (stamp), or -1. */
  stamp: number
  pop: 'storm' | 'ask' | null
  /** Cloud phases (far, near), baked from event times, never from `now`. */
  drift: [number, number]
}

export const ONE_SHOT_MS = { glide: 1600, takeoff: 2600, stamp: 2500, storm: 1000, ask: 1000, landingParty: 6000, landingQuiet: 3000 } as const

// ---------------------------------------------------------------- size

// Explicit pixel sizing (lab S1): an integer number of screen pixels per art
// pixel, so every pixel is crisp, and as many art units as fit the pane.
export function sceneSize(columns: number, isStrip: boolean): { W: number; H: number; scale: number; pxW: number; pxH: number; cells: number } {
  const cols = Number.isFinite(columns) && columns > 0 ? columns : 0
  const pxAvail = Math.max(120, Math.floor(cols * 8 * 0.98))
  const scale = pxAvail < 360 ? 2 : pxAvail < 840 ? 3 : 4
  const W = Math.floor(pxAvail / scale)
  const H = isStrip ? 30 : 60

  return { W, H, scale, pxW: W * scale, pxH: H * scale, cells: Math.floor(cols * 0.98) }
}

// ---------------------------------------------------------------- pose and clock

const isLive = (step: Step) => step.status !== 'removed'

export function scenePose(route: Route | null, live: Live): ScenePose {
  if (route === null || !route.steps.some(isLive)) return 'empty'
  if (route.landedAt > 0) return 'landed'
  if (live.waiting !== null) return 'ask'
  if (route.gate === 'waiting') return 'boarding'
  if (route.gate === 'held') return 'ground'
  if (!live.isRunning) return route.isPaused ? 'paused' : 'holding'
  if (live.failedRuns >= 3) return 'storm'
  if (live.failedRuns >= 1) return 'chop'

  return 'air'
}

// Sky time (R2): closed steps only, never a real clock and never an ETA.
// Empty 5:30 AM, at the gate 5:45 AM, landed 7:00 PM; in the air 6:00 AM
// plus 780 minutes x done/total, capped at 6:40 PM until the landing.
export function clockOf(route: Route | null): { minutes: number; label: string; bucket: SkyBucket } {
  const minutes = minutesOf(route)

  return { minutes, label: clockLabel(minutes), bucket: bucketOf(minutes) }
}

function minutesOf(route: Route | null): number {
  if (route === null) return 330
  const { total, done } = counts(route)
  if (total === 0) return 330
  if (route.landedAt > 0) return 1140
  if (route.gate !== 'go') return 345

  return Math.min(1120, 360 + Math.floor((780 * done) / total))
}

function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const mm = String(minutes % 60).padStart(2, '0')

  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

function bucketOf(minutes: number): SkyBucket {
  if (minutes < 360) return 'predawn'
  if (minutes < 480) return 'dawn'
  if (minutes < 660) return 'morning'
  if (minutes < 840) return 'noon'
  if (minutes < 990) return 'afternoon'
  if (minutes < 1140) return 'golden'

  return 'dusk'
}

// ---------------------------------------------------------------- stops and signs

// The pins: stops with at least one live step, or one you proposed. At most 8.
export function stopsOf(route: Route): Feature[] {
  return route.features.filter(feature => feature.proposedBy === 'you' || route.steps.some(step => isLive(step) && step.featureId === feature.id)).slice(0, 8)
}

// Leading words that say nothing about where we are going ("Let people log
// in" is "log in"), words dropped anywhere, and words a sign never ends on.
const LEADING = new Set(
  "let lets let's make makes add adds adding build builds create set setup up get have write implement support allow enable users user people you can we i our my your new basic simple initial first all some short small quick proper better keep do then also".split(' '),
)
const ARTICLES = new Set(['a', 'an', 'the'])
const DANGLING = new Set(['and', 'or', 'with', 'for', 'of', 'to', 'from', 'by', 'at', '&', '+', '-'])

// A whole word cut to at most `max` UTF-16 units, never splitting a pair.
function cut(word: string, max: number): string {
  let out = ''
  for (const char of word) {
    if (out.length + char.length > max) break
    out += char
  }

  return out
}

// The sign under a pin, at most 8 characters, in any script (R3).
export function signOf(title: string, index: number): string {
  const words = title
    .split(/[\s/|]+/)
    .map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(word => word !== '')
  let at = 0
  while (at < words.length && LEADING.has((words[at] ?? '').toLowerCase())) at++
  const rest = words.slice(at).filter(word => !ARTICLES.has(word.toLowerCase()))
  const kept: string[] = []
  for (const word of rest) {
    if ([...kept, word].join(' ').length > 8) break
    kept.push(word)
  }
  while (kept.length > 1 && DANGLING.has((kept[kept.length - 1] ?? '').toLowerCase())) kept.pop()
  const sign = kept.length > 0 ? kept.join(' ') : cut(rest[0] ?? '', 8)

  return sign === '' ? `stop ${index + 1}` : sign
}

// ---------------------------------------------------------------- layout (art units)

type Layout = {
  x0: number
  x1: number
  routeY: number
  cruiseY: number
  parkY: number
  runwayY: number
  groundY: number
  feetY: number
  gateX: number
  stopX: number
  horizon: number
  sunAmp: number
  bands: readonly number[]
}

// Everything is computed from W. Zones (banner, H 60): the sun's arc and far
// clouds up top, the plane cruising at 14-26, the route and pins at 29-37,
// low clouds and hills 37-46, the ground strip 46-57 (towers, runways,
// captain, crew). The strip (H 30) is sky, plane, route and pins, with a
// runway stub at each end.
function layoutOf(W: number, H: number, isStrip: boolean): Layout {
  const x0 = Math.min(33, Math.round(W * 0.28))
  if (isStrip) {
    return { x0, x1: W - 30, routeY: 27, cruiseY: 4, parkY: 12, runwayY: 25, groundY: H, feetY: H, gateX: 2, stopX: W - 28, horizon: 27, sunAmp: 22, bands: [0, 8, 15, 22, H] }
  }

  return { x0, x1: W - 24, routeY: 37, cruiseY: 14, parkY: 39, runwayY: 52, groundY: 46, feetY: 57, gateX: 2, stopX: W - 39, horizon: 40, sunAmp: 33, bands: [0, 12, 24, 35, 46] }
}

// Pins are destinations, evenly spaced (R3).
function pinX(L: Layout, i: number, n: number): number {
  return Math.round(L.x0 + ((i + 0.5) * (L.x1 - L.x0)) / n)
}

// Where on the route a step puts the plane: on leg i (toward pin i), step k
// of m sits at (k + 0.5) / m of the way from the previous pin.
function legX(route: Route, stops: Feature[], L: Layout, stepId: string | null | undefined): number {
  const n = stops.length
  if (n === 0) return L.x0
  const step = stepId === null || stepId === undefined ? undefined : route.steps.find(one => one.id === stepId)
  const i = step === undefined ? -1 : stops.findIndex(feature => feature.id === step.featureId)
  if (step === undefined || i < 0) return counts(route).done === 0 ? L.x0 : pinX(L, n - 1, n)
  const leg = route.steps.filter(one => isLive(one) && one.featureId === step.featureId)
  const k = Math.max(0, leg.indexOf(step))
  const m = Math.max(1, leg.length)
  const prev = i === 0 ? L.x0 : pinX(L, i - 1, n)

  return Math.round(prev + ((k + 0.5) / m) * (pinX(L, i, n) - prev))
}

function pinStateOf(route: Route, feature: Feature, isCurrent: boolean): PinState {
  const live = route.steps.filter(step => isLive(step) && step.featureId === feature.id)
  if (live.length === 0) return 'yours'
  if (live.some(step => step.status === 'failed')) return 'failed'
  if (isStopVerified(route, feature.id)) return 'verified'
  if (live.every(isClosed)) return 'done'

  return isCurrent ? 'current' : 'pending'
}

function tipOf(route: Route, feature: Feature): string {
  const live = route.steps.filter(step => isLive(step) && step.featureId === feature.id)
  if (live.length === 0) return `${feature.title} · a stop you added`

  return `${feature.title} · ${live.filter(isClosed).length} of ${live.length} steps done`
}

// ---------------------------------------------------------------- the key

const GROUND_POSES: readonly ScenePose[] = ['empty', 'ground', 'boarding', 'landed']

// Cloud speeds (art units per second, far and near) by pose. Idle poses keep
// one slow layer (R24); paused stops them.
const DRIFT: Record<ScenePose, readonly [number, number]> = {
  air: [2, 4],
  chop: [2, 4],
  storm: [2, 4],
  ask: [1, 2],
  holding: [1, 0],
  empty: [1, 0],
  ground: [1, 0],
  boarding: [1, 0],
  landed: [1, 0],
  paused: [0, 0],
}

export function sceneKey(input: { route: Route | null; live: Live; now: number; columns: number; isStrip: boolean; isCalm: boolean }): SceneKey {
  const { route, live, now, isStrip, isCalm } = input
  const { W, H, scale } = sceneSize(input.columns, isStrip)
  const L = layoutOf(W, H, isStrip)
  const state = scenePose(route, live)
  const { minutes, bucket } = clockOf(route)
  const stops = route === null || state === 'empty' ? [] : stopsOf(route)
  const atGate = route !== null && (state === 'ground' || state === 'boarding' || (state === 'ask' && route.gate !== 'go'))
  const isFlying = route !== null && !atGate && !GROUND_POSES.includes(state)
  const planeStep = isFlying ? route.steps.find(step => step.id === route.plane) : undefined
  const pins = route === null ? [] : stops.map((feature, i) => ({ state: pinStateOf(route, feature, planeStep?.featureId === feature.id), sign: signOf(feature.title, i), tip: tipOf(route, feature) }))
  const planeX = route === null || state === 'empty' || atGate ? L.x0 : state === 'landed' ? L.x1 : legX(route, stops, L, route.plane)
  const landing = route !== null && state === 'landed' ? landingOf(route) : null

  // One-shots, from persisted event times (R4). Any change to the key
  // restarts every animation in the picture, so one-shots that start
  // together stay together until the longest of them ends, and a one-shot
  // older than the scene's last change is dropped rather than replayed.
  const group = route === null || isCalm ? { shots: [], since: 0, end: 0 } : groupOf(route, live, now, state, isFlying)
  const shots = group.shots
  const has = (kind: Shot['kind']) => shots.find(shot => shot.kind === kind)
  // Take off pressed (or the countdown ran out) while Claude is idle: the
  // plane flies it at once, so the Go turn starting changes nothing.
  const pose: ScenePose = state === 'holding' && has('takeoff') !== undefined ? 'air' : state
  let move: SceneMove | null = null
  if (has('landing') !== undefined) move = { kind: 'landing', fromX: route === null ? L.x1 : legX(route, stops, L, route.plane) }
  else if (has('takeoff') !== undefined) move = { kind: 'takeoff' }
  else if (has('glide') !== undefined && route !== null) {
    // Glide only from a step that still has its pin: one removed (or its
    // stop) has no place on the route any more, so the plane just moves.
    const from = route.steps.find(step => step.id === route.planeFrom)
    const isPinned = from !== undefined && isLive(from) && stops.some(feature => feature.id === from.featureId)
    const fromX = route.planeFrom === null || route.planeFrom === undefined ? L.x0 : isPinned ? legX(route, stops, L, route.planeFrom) : planeX
    if (fromX !== planeX) move = { kind: 'glide', fromX, isUturn: fromX > planeX }
  }
  const stamped = move?.kind === 'landing' ? undefined : has('stamp')
  const stamp = stamped === undefined ? -1 : stops.findIndex(feature => feature.id === stamped.featureId)
  const pop: SceneKey['pop'] = has('storm') !== undefined ? 'storm' : has('ask') !== undefined ? 'ask' : null

  const crew = isStrip ? [] : live.helpers.slice(0, 3).map((helper, i) => ({ variant: i % 3, isBack: helper.isDone }))

  return {
    W,
    H,
    scale,
    isStrip,
    isCalm,
    pose,
    atGate,
    minutes,
    bucket,
    pins,
    planeX,
    crew,
    extraCrew: isStrip ? 0 : Math.max(0, live.helpers.length - 3),
    landing,
    move,
    stamp,
    pop,
    drift: isCalm || route === null ? [0, 0] : driftOf(group.end > 0 && now >= group.end ? Math.max(group.since, group.end) : group.since, pose, W),
  }
}

type Shot = { kind: 'landing' | 'takeoff' | 'glide' | 'stamp' | 'storm' | 'ask'; at: number; window: number; featureId?: string }

// Every persisted moment that can change the picture. `changedAt` stamps a
// change with no time of its own (the turn ending, a question answered, a
// route call that redraws a pin), so a running one-shot is dropped there,
// not replayed by the new source. The Go turn that a take-off was waiting
// for is part of the take-off, not a change.
function eventsOf(route: Route, live: Live): number[] {
  const askAt = (live.waiting as { at?: unknown } | null)?.at
  const takeoffAt = route.takeoffAt ?? 0
  const isGoTurn = takeoffAt > 0 && live.turnStartedAt >= takeoffAt && live.turnStartedAt < takeoffAt + ONE_SHOT_MS.takeoff

  return [
    route.setAt,
    route.movedAt,
    takeoffAt,
    route.landedAt,
    route.tests?.at ?? 0,
    isGoTurn ? 0 : live.turnStartedAt,
    live.changedAt ?? 0,
    typeof askAt === 'number' ? askAt : 0,
    ...route.steps.map(step => step.checkedAt ?? 0),
    ...route.edits.map(edit => edit.at),
    ...live.helpers.map(helper => Math.max(helper.startedAt ?? 0, helper.doneAt ?? 0)),
  ]
}

// The one-shots this state could show, each from its event time.
function candidatesOf(route: Route, live: Live, pose: ScenePose, isFlying: boolean): Shot[] {
  const out: Shot[] = []
  if (pose === 'landed') out.push({ kind: 'landing', at: route.landedAt, window: landingOf(route) === 'party' ? ONE_SHOT_MS.landingParty : ONE_SHOT_MS.landingQuiet })
  if (isFlying && pose !== 'paused') {
    out.push({ kind: 'takeoff', at: route.takeoffAt ?? 0, window: ONE_SHOT_MS.takeoff })
    if (route.planeFrom !== undefined && route.planeFrom !== route.plane) out.push({ kind: 'glide', at: route.movedAt, window: ONE_SHOT_MS.glide })
  }
  const fresh = route.steps.filter(hasReceipts).reduce<Step | undefined>((best, step) => ((step.checkedAt ?? 0) > (best?.checkedAt ?? 0) ? step : best), undefined)
  if (fresh?.checkedAt !== undefined) out.push({ kind: 'stamp', at: fresh.checkedAt, window: ONE_SHOT_MS.stamp, featureId: fresh.featureId })
  if (pose === 'storm' && live.failedRuns === 3) out.push({ kind: 'storm', at: route.tests?.at ?? 0, window: ONE_SHOT_MS.storm })
  const askAt = (live.waiting as { at?: unknown } | null)?.at
  if (pose === 'ask' && typeof askAt === 'number') out.push({ kind: 'ask', at: askAt, window: ONE_SHOT_MS.ask })

  return out.filter(shot => shot.at > 0)
}

// Shots that began with the picture's last change (within 250 ms of it),
// kept as a group while the longest of them runs; when it ends, the picture
// changes again at that moment.
function groupOf(route: Route, live: Live, now: number, pose: ScenePose, isFlying: boolean): { shots: Shot[]; since: number; end: number } {
  const since = eventsOf(route, live).reduce((most, time) => (time <= now ? Math.max(most, time) : most), 0)
  const group = candidatesOf(route, live, pose, isFlying).filter(shot => shot.at >= since - 250)
  const end = group.reduce((most, shot) => Math.max(most, shot.at + shot.window), 0)

  return { shots: now < end ? group : [], since, end }
}

// The clouds keep drifting across redraws: a new source starts its loop
// from 0, so it is shifted by where the clouds would be at the moment the
// picture last changed (the latest event, or the end of the one-shots that
// began with it; event times, never `now`).
function driftOf(at: number, pose: ScenePose, W: number): [number, number] {
  const [far, near] = DRIFT[pose]
  const phase = (speed: number) => (W > 0 ? Math.floor((at / 1000) * speed) % W : 0)

  return [phase(far), phase(near)]
}

// ---------------------------------------------------------------- drawing helpers

type Ctx = { k: SceneKey; L: Layout; sky: Sky }

type Anim = {
  /** animate: the attribute (opacity, visibility, fill). Omit for a transform. */
  attr?: 'opacity' | 'visibility' | 'fill'
  type?: 'translate' | 'scale' | 'rotate'
  values: string
  dur: number
  keyTimes?: string
  keySplines?: string
  calcMode?: 'discrete' | 'linear' | 'spline'
  begin?: number
  repeat?: number | 'indefinite'
  isFrozen?: boolean
  isAdditive?: boolean
}

const secs = (n: number) => `${Math.round(n * 1000) / 1000}s`

// Every animation element in the sky comes from here, so calm (no motion at
// all) is one flag, and the budget is easy to count.
function anim(c: Ctx, a: Anim): string {
  if (c.k.isCalm) return ''
  const head = a.type === undefined ? `<animate attributeName="${a.attr ?? 'opacity'}"` : `<animateTransform attributeName="transform" type="${a.type}"`
  const parts = [head, `values="${a.values}"`]
  if (a.keyTimes !== undefined) parts.push(`keyTimes="${a.keyTimes}"`)
  if (a.keySplines !== undefined) parts.push(`keySplines="${a.keySplines}"`)
  if (a.calcMode !== undefined) parts.push(`calcMode="${a.calcMode}"`)
  parts.push(`dur="${secs(a.dur)}"`)
  if (a.begin !== undefined && a.begin > 0) parts.push(`begin="${secs(a.begin)}"`)
  if (a.repeat !== undefined) parts.push(`repeatCount="${a.repeat}"`)
  if (a.isFrozen === true) parts.push('fill="freeze"')
  if (a.isAdditive === true) parts.push('additive="sum"')

  return `${parts.join(' ')}/>`
}

// A frame that shows for part of a loop: visible during [from, to) of `dur`.
function blink(c: Ctx, dur: number, from = 0, to = 0.5, begin = 0): string {
  const values = from === 0 ? 'visible;hidden' : 'hidden;visible;hidden'
  const keyTimes = from === 0 ? `0;${to}` : `0;${from};${to}`

  return anim(c, { attr: 'visibility', values, keyTimes, calcMode: 'discrete', dur, begin, repeat: 'indefinite' })
}

const g = (inner: string, attrs = '') => (inner === '' ? '' : `<g${attrs}>${inner}</g>`)
const at = (x: number, y: number) => ` transform="translate(${Math.round(x)} ${Math.round(y)})"`
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  w > 0 && h > 0 ? `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"${extra}/>` : ''
const pixels = (fill: string, list: [number, number, number, number][], extra = '') =>
  list.length === 0 ? '' : `<path fill="${fill}"${extra} d="${list.map(([x, y, w, h]) => `M${Math.round(x)} ${Math.round(y)}h${w}v${h}h-${w}z`).join('')}"/>`

// The card's outline at inset d: a rectangle with 2-step pixel corners.
function outline(W: number, H: number, d: number): string {
  return `M${d + 2} ${d}H${W - d - 2}V${d + 1}H${W - d - 1}V${d + 2}H${W - d}V${H - d - 2}H${W - d - 1}V${H - d - 1}H${W - d - 2}V${H - d}H${d + 2}V${H - d - 1}H${d + 1}V${H - d - 2}H${d}V${d + 2}H${d + 1}V${d + 1}H${d + 2}Z`
}

const isGrounded = (k: SceneKey) => k.pose === 'empty' || k.pose === 'landed' || k.atGate
const isIdle = (k: SceneKey) => k.pose === 'empty' || k.pose === 'holding' || k.pose === 'paused' || k.pose === 'ground' || (k.pose === 'landed' && k.move === null)

// ---------------------------------------------------------------- layers: sky

function skyLayer(c: Ctx): string {
  const { W, H } = c.k
  const e = c.L.bands
  const colors = c.sky.bands
  const at0 = e[1] ?? 12
  const parts = [`<path fill="${colors[0]}" d="M2 0h${W - 4}v1h1v1h1v${at0 - 2}h-${W}v-${at0 - 2}h1v-1h1z"/>`]
  for (let i = 1; i < 4; i++) {
    const top = e[i] ?? 0
    const bottom = e[i + 1] ?? H
    const color = colors[i] ?? colors[0]
    const isLast = i === 3 && bottom >= H
    parts.push(
      isLast
        ? `<path fill="${color}" d="M0 ${top}h${W}v${bottom - top - 2}h-1v1h-1v1h-${W - 4}v-1h-1v-1h-1z"/>`
        : rect(0, top, W, bottom - top, color),
    )
  }
  // 8-bit banding: each boundary interleaves one line of each color.
  for (let i = 1; i < 4; i++) {
    const y = e[i] ?? 0
    parts.push(rect(0, y - 2, W, 1, colors[i] ?? colors[0]), rect(0, y + 1, W, 1, colors[i - 1] ?? colors[0]))
  }

  return parts.join('')
}

// Take-off happens at first light: the pre-dawn sky fades into dawn.
function dawnFade(c: Ctx): string {
  const { W, H } = c.k
  const e = c.L.bands
  const pre = SKIES.predawn.bands
  // Inside the frame only: its cut-away corner pixels stay clear.
  const bands = pre
    .map((color, i) => {
      const top = Math.max(2, e[i] ?? 0)
      const bottom = Math.min(H - 2, e[i + 1] ?? c.L.groundY)

      return rect(0, top, W, bottom - top, color)
    })
    .join('')

  return `<g opacity="0">${bands}${anim(c, { attr: 'opacity', values: '1;1;0', keyTimes: '0;0.4;1', dur: 1.6, isFrozen: true })}</g>`
}

// The sun climbs from sunrise (6:00) to sunset (7:00 PM) with the sky clock,
// east to west as seen facing north: it rises on the right, over the
// destination, and sets on the left. The plane flies the other way, so the
// two cross only at noon, with the sun high above.
function sunLayer(c: Ctx): string {
  const { k, L } = c
  const t = Math.min(1.06, Math.max(-0.08, (k.minutes - 360) / 780))
  // It rises left of the destination tower (W - 11 on), so first light shows.
  const right = k.W - 20
  let x = Math.min(right, Math.max(4, Math.round(right - t * (k.W - 24))))
  const cy = L.horizon - Math.round(Math.sin(Math.PI * t) * L.sunAmp)
  // In the strip the high sun shares the plane's band: it steps to the far
  // side of the plane (x - 13 to x + 12) rather than hide behind it.
  if (k.isStrip && !isGrounded(k) && Math.abs(x + 4 - k.planeX) < 17) x = k.planeX + 17 <= right ? k.planeX + 17 : k.planeX - 26
  const pal = { Y: c.sky.sun }
  const body = toPaths(SUN_BODY, pal)
  if (cy > L.horizon) return g(body, at(x, cy - 4))
  const rays = isIdle(k) ? toPaths(SUN_RAYS_A, pal) : `${g(toPaths(SUN_RAYS_A, pal) + blink(c, 4, 0, 0.5))}${g(toPaths(SUN_RAYS_B, pal) + blink(c, 4, 0.5, 1), ' visibility="hidden"')}`

  return g(body + rays, at(x, cy - 4))
}

// A drifting cloud layer, shifted by its baked phase on an outer group (no
// negative begin) and looped from 0 to -W on an inner one. The two shifts
// add up to as much as 2W, so the clouds are drawn three times side by side:
// the sky is covered at every phase, all lap long.
function cloudLayer(c: Ctx, clouds: [Grid, number, number][], palette: Palette, phase: number, speed: number, extra = ''): string {
  const { W } = c.k
  const one = clouds.map(([grid, x, y]) => sprite(grid, palette, x, y)).join('')
  const loop = speed > 0 ? anim(c, { type: 'translate', values: `0 0;-${W} 0`, dur: W / speed, repeat: 'indefinite' }) : ''

  return `<g transform="translate(${-phase} 0)"${extra}><g>${one}<g transform="translate(${W} 0)">${one}</g><g transform="translate(${2 * W} 0)">${one}</g>${loop}</g></g>`
}

function farClouds(c: Ctx): string {
  const { k } = c
  const y = k.isStrip ? [3, 7, 2] : [4, 9, 2]
  const xs = [0.06, 0.4, 0.73].map(f => Math.round(k.W * f))
  const clouds = xs.map((x, i): [Grid, number, number] => [CLOUD_SMALL, x, y[i] ?? 4])
  const palette = { F: c.sky.cloud, c: c.sky.shade }

  return cloudLayer(c, clouds, palette, k.drift[0], DRIFT[k.pose][0], ' opacity=".85"')
}

function nearClouds(c: Ctx): string {
  const { k } = c
  const xs = [0.18, 0.62].map(f => Math.round(k.W * f))
  const clouds: [Grid, number, number][] = [
    [CLOUD_BIG, xs[0] ?? 0, 38],
    [CLOUD_BIG, xs[1] ?? 0, 41],
  ]
  const palette = k.pose === 'storm' ? { F: '#6B7280', c: '#4B5563' } : { F: c.sky.cloud, c: c.sky.shade }

  return cloudLayer(c, clouds, palette, k.drift[1], DRIFT[k.pose][1])
}

// ---------------------------------------------------------------- layers: the airfield

function hillsPath(W: number, base: number): string {
  const heights = [2, 4, 6, 5, 3, 2, 3, 5, 6, 4]
  let d = `M0 ${base}`
  for (let x = 0, i = 0; x < W; x += 6, i++) d += `V${base - (heights[i % heights.length] ?? 3)}H${Math.min(W, x + 6)}`

  return `${d}V${base}z`
}

function runway(c: Ctx, from: number, to: number): string {
  const y = c.L.runwayY
  const dashes: [number, number, number, number][] = []
  for (let x = from + 2; x + 4 <= to - 2; x += 8) dashes.push([x, y + 1, 4, 1])

  return rect(from, y, to - from, 3, ASPHALT) + pixels(PAINT, dashes)
}

// Edge lights along the destination runway, lit at dusk.
function runwayLights(c: Ctx, from: number, to: number, color: string, isTwinkle: boolean): string {
  const list: [number, number, number, number][] = []
  for (let x = from + 1; x < to; x += 4) list.push([x, c.L.runwayY - 1, 1, 1])
  const lights = pixels(color, list)

  return isTwinkle ? g(lights + anim(c, { attr: 'opacity', values: '1;.35;1', dur: 2.4, repeat: 'indefinite' })) : lights
}

function tower(c: Ctx, x: number, beacon: string, isBlinking: boolean): string {
  const top = c.L.feetY - 16
  const light = rect(4, -1, 1, 1, beacon)

  return g(toPaths(TOWER, TOWER_PALETTE) + (isBlinking ? g(light + blink(c, 2, 0, 0.5)) : light), at(x, top))
}

function hillsLayer(c: Ctx): string {
  return `<path fill="${c.sky.hills}" d="${hillsPath(c.k.W, c.L.groundY)}"/>`
}

function groundLayer(c: Ctx): string {
  const { k, L } = c
  const { W, H } = k
  const gy = L.groundY
  const parts = [
    `<path fill="${c.sky.ground}" d="M0 ${gy}h${W}v${H - gy - 2}h-1v1h-1v1h-${W - 4}v-1h-1v-1h-1z"/>`,
    rect(0, gy, W, 1, c.sky.hills),
    runway(c, 2, Math.round(W * 0.38)),
    runway(c, W - Math.round(W * 0.38), W - 2),
  ]
  if (k.pose === 'landed') {
    const color = k.landing === 'amber' ? AMBER : LAMP
    parts.push(runwayLights(c, W - Math.round(W * 0.38), W - 2, color, k.landing === 'party' && k.move === null))
  }
  // Towers: the gate tower beside the parked plane, the destination tower at
  // the far end. After a landing the destination beacon is the one slow loop
  // (R24), amber when tests still fail; a party has its runway lights instead.
  const beacon = k.pose === 'landed' && k.landing === 'amber' ? AMBER : RED
  parts.push(tower(c, L.gateX + 27, RED, false), tower(c, W - 11, beacon, k.pose === 'landed' && k.landing !== 'party'))

  return parts.join('')
}

// The strip has no ground: a runway stub under a parked plane.
function stripGround(c: Ctx): string {
  const { k, L } = c
  if (k.pose === 'empty' || k.atGate) return runway(c, 2, L.gateX + 30)
  if (k.pose === 'landed') return runway(c, L.stopX - 4, k.W - 2)

  return ''
}

// ---------------------------------------------------------------- layers: route and pins

function routeLayer(c: Ctx): string {
  const { k, L } = c
  const y = L.routeY
  if (k.pose === 'empty') {
    const sx = Math.round(k.W / 2)
    const dots: [number, number, number, number][] = []
    for (let x = L.x0; x < sx - 5; x += 3) dots.push([x, y, 1, 1])

    return pixels(INK, dots, ' opacity=".3"') + sprite(SIGNPOST, BASE, sx - 4, y - 11)
  }
  const flown = k.pose === 'landed' ? L.x1 : k.planeX
  const trail: [number, number, number, number][] = []
  const dots: [number, number, number, number][] = []
  const shade: [number, number, number, number][] = []
  for (let x = L.x0; x + 3 <= flown; x += 4) {
    trail.push([x, y, 3, 1])
    shade.push([x + 1, y + 1, 3, 1])
  }
  for (let x = L.x0; x <= L.x1; x += 3) if (x >= flown) dots.push([x, y, 1, 1])

  // The flown part: cream dashes with a soft shadow, so it reads on any sky.
  return pixels(INK, shade, ' opacity=".3"') + pixels(CREAM, trail) + pixels(INK, dots, ' opacity=".45"')
}

function pinsLayer(c: Ctx): string {
  const { k, L } = c
  const n = k.pins.length
  if (n === 0) return ''
  const isMini = (L.x1 - L.x0) / n < 9
  const tip = isMini ? MINI_TIP : PIN_TIP
  const top = L.routeY - (isMini ? 6 : 8)
  const sparkles: string[] = []
  let current = ''
  const pins = k.pins.map((pin, i) => {
    const x = pinX(L, i, n)
    let art: string
    if (pin.state === 'verified') {
      const flagTip = isMini ? 1 : FLAG_TIP
      art = sprite(isMini ? MINI_FLAG : FLAG, BASE, x - flagTip, top)
      if (!isMini) sparkles.push(sprite(SPARKLE, BASE, x + 7, top - 1))
    } else if (pin.state === 'done') {
      art = sprite(isMini ? MINI_DONE : PIN_DONE, BASE, x - tip, top)
    } else if (pin.state === 'failed') {
      art = sprite(isMini ? MINI_FAILED : PIN_FAILED, BASE, x - tip, top)
    } else {
      const palette = pin.state === 'current' ? PIN_CURRENT : pin.state === 'yours' ? PIN_PROPOSED : PIN_PENDING
      art = sprite(isMini ? MINI_PIN : pin.state === 'yours' ? PIN_YOURS : PIN, palette, x - tip, top)
      if (pin.state === 'current') {
        // The pin we are flying to: a red beacon above it and a white heart
        // that blink together (idle scenes keep them lit, no loop).
        const lit = rect(x, top - 2, 1, 1, RED) + rect(x, top + (isMini ? 1 : 3), 1, 1, WHITE)
        current = isIdle(k) || k.pose === 'ask' ? lit : g(lit + blink(c, 1.2, 0, 0.6))
      }
    }

    return `<g><title>${esc(pin.tip)}</title>${art}</g>`
  })
  const twinkle = sparkles.length > 0 && !isIdle(k) && !isGrounded(k) ? anim(c, { attr: 'opacity', values: '1;.3;1', dur: 2, repeat: 'indefinite' }) : ''

  return pins.join('') + current + g(sparkles.join('') + twinkle)
}

// ---------------------------------------------------------------- layers: people

function captainOf(c: Ctx, x: number, mode: 'mug' | 'wave' | 'idle' | 'clipboard' | 'ask'): string {
  const top = c.L.feetY - 13
  const idle = toPaths(CAPTAIN, BASE)
  if (mode === 'mug') {
    const steam = sprite(STEAM, BASE, STEAM_AT[0], STEAM_AT[1], blink(c, 1.5, 0, 0.5))

    return g(idle + sprite(MUG, BASE, MUG_AT[0], MUG_AT[1]) + steam, at(x, top))
  }
  if (mode === 'clipboard') return g(idle + sprite(CLIPBOARD, BASE, CLIPBOARD_AT[0], CLIPBOARD_AT[1]), at(x, top))
  // At the gate: a small "?" between the pins (down to y 37) and the cap,
  // bobbing down, so it never covers a pin or the route.
  if (mode === 'ask') return g(idle + sprite(QUESTION_SMALL, BASE, 9, -6, anim(c, { type: 'translate', values: '0 0;0 1', calcMode: 'discrete', dur: 1.2, repeat: 'indefinite', isAdditive: true })), at(x, top))
  if (mode === 'wave') {
    // A wave every 2 s while boarding.
    return g(g(idle + blink(c, 2, 0, 0.7)) + g(toPaths(CAPTAIN_WAVE, BASE) + blink(c, 2, 0.7, 1), ' visibility="hidden"'), at(x, top))
  }
  return g(idle, at(x, top))
}

type CrewLook = 'work' | 'stand' | 'cheer'

function crewSprite(variant: number, grid: Grid, x: number, y: number): string {
  const outfit = OUTFITS[variant % 3] ?? OUTFITS[0]
  if (outfit === undefined) return ''

  return sprite(grid, outfit.palette, x, y, sprite(outfit.extra, outfit.palette, outfit.extraAt[0], outfit.extraAt[1]))
}

// The crew stand in a row from x; workers alternate stand and walk frames
// (busy feet), all in step so the whole crew costs two animations.
function crewRow(c: Ctx, x: number, cheer: { begin: number } | null): string {
  const { k, L } = c
  const top = L.feetY - 12
  const looks = k.crew.map((one): CrewLook => (cheer !== null ? 'cheer' : one.isBack ? 'stand' : 'work'))
  const still: string[] = []
  const frameA: string[] = []
  const frameB: string[] = []
  k.crew.forEach((one, i) => {
    const cx = x + i * 10
    if (looks[i] === 'stand' || k.isCalm || (cheer === null && isIdle(k))) still.push(crewSprite(one.variant, CREW_STAND, cx, top))
    else {
      frameA.push(crewSprite(one.variant, CREW_STAND, cx, top))
      frameB.push(crewSprite(one.variant, looks[i] === 'cheer' ? CREW_CHEER : CREW_WALK, cx, top))
    }
  })
  const plus = k.extraCrew > 0 ? sprite(PLUS, BASE, x + k.crew.length * 10, top + 3) : ''
  let moving = ''
  if (frameA.length > 0) {
    moving =
      cheer === null
        ? g(frameA.join('') + blink(c, 0.8, 0, 0.5)) + g(frameB.join('') + blink(c, 0.8, 0.5, 1), ' visibility="hidden"')
        : cheerFrames(c, frameA.join(''), frameB.join(''), cheer.begin)
  }

  return still.join('') + moving + plus
}

// Cheer 4 times, then stand: the rest frame is the last value, so it holds.
function cheerFrames(c: Ctx, stand: string, cheer: string, begin: number): string {
  const each = { calcMode: 'discrete' as const, keyTimes: '0;0.5;1', dur: 0.6, begin, repeat: 4, isFrozen: true }

  return g(stand + anim(c, { attr: 'visibility', values: 'visible;hidden;visible', ...each })) + g(cheer + anim(c, { attr: 'visibility', values: 'hidden;visible;hidden', ...each }), ' visibility="hidden"')
}

function figures(c: Ctx): string {
  const { k, L } = c
  const crewWidth = k.crew.length * 10 + (k.extraCrew > 0 ? 6 : 0)
  if (k.pose === 'empty') return captainOf(c, L.gateX + 37, 'mug')
  if (k.atGate) {
    const mode = k.pose === 'ask' ? 'ask' : k.pose === 'boarding' ? 'wave' : 'mug'

    return captainOf(c, L.gateX + 37, mode) + crewRow(c, L.gateX + 52, null)
  }
  if (k.pose === 'landed') {
    const x = L.stopX - 12
    const isParty = k.landing === 'party'
    const isLanding = k.move?.kind === 'landing'
    const crewX = Math.max(4, x - 2 - crewWidth)
    const sign = k.landing === 'amber' ? sprite(WARNING, BASE, x - 10, L.feetY - 12) : ''
    // Confetti lies under the people and the plane, flying or at rest, so
    // the party's end changes nothing on screen.
    const confetti = !isParty ? '' : isLanding ? confettiLayer(c) : confettiResting(c)
    let people: string
    if (isParty && isLanding && !k.isCalm) {
      const cap = cheerFrames(c, toPaths(CAPTAIN, BASE), toPaths(CAPTAIN_WAVE, BASE), 2.8)
      people = g(cap, at(x, L.feetY - 13)) + crewRow(c, crewX, { begin: 2.8 })
    } else {
      people = captainOf(c, x, k.landing === 'quiet' ? 'clipboard' : 'idle') + crewRow(c, k.landing === 'amber' ? crewX - 10 : crewX, null)
    }
    // People step out once the plane has stopped.
    const reveal = isLanding ? anim(c, { attr: 'visibility', values: 'hidden;visible', keyTimes: '0;0.9', calcMode: 'discrete', dur: 2.8, isFrozen: true }) : ''

    return confetti + g(sign + people + reveal)
  }
  // In flight the crew work on the ground under the stop they are on.
  if (k.crew.length === 0) return ''
  const n = k.pins.length
  const current = k.pins.findIndex(pin => pin.state === 'current')
  const centre = n > 0 && current >= 0 ? pinX(L, current, n) : k.planeX
  const x = Math.max(L.gateX + 46, Math.min(k.W - 44 - crewWidth, Math.round(centre - crewWidth / 2)))

  return crewRow(c, x, null)
}

// ---------------------------------------------------------------- layers: the plane

type Prop = 'spin' | 'blur' | 'still' | 'stop'

function planeBody(c: Ctx, look: { isPilot: boolean; gear: 'up' | 'down' | 'retract' | 'extend'; prop: Prop; isPuffs: boolean }): string {
  const parts = [toPaths(PLANE, BASE)]
  if (look.isPilot) parts.push(sprite(PILOT, BASE, PILOT_AT[0], PILOT_AT[1]))
  const full = sprite(PROP_FULL, BASE, PROP_AT[0], PROP_AT[1])
  const blurred = `<g opacity=".55">${sprite(PROP_BLUR, BASE, PROP_AT[0], PROP_AT[1])}</g>`
  if (look.prop === 'still') parts.push(full)
  else if (look.prop === 'blur') parts.push(blurred)
  else if (look.prop === 'spin') parts.push(blurred + sprite(PROP_EDGE, BASE, PROP_AT[0], PROP_AT[1], blink(c, 0.16, 0, 0.5)))
  else {
    // Winds down on the landing roll, then stops on the full blade.
    const stop = { attr: 'visibility' as const, keyTimes: '0;0.95', calcMode: 'discrete' as const, dur: 2.8, isFrozen: true }
    parts.push(g(blurred + anim(c, { values: 'visible;hidden', ...stop })) + g(full + anim(c, { values: 'hidden;visible', ...stop }), c.k.isCalm ? '' : ' visibility="hidden"'))
  }
  const gear = sprite(GEAR, BASE, 0, GEAR_AT)
  if (look.gear === 'down') parts.push(gear)
  if (look.gear === 'retract') parts.push(g(gear + anim(c, { attr: 'visibility', values: 'visible;hidden', keyTimes: '0;0.5', calcMode: 'discrete', dur: 2.2, isFrozen: true }), ' visibility="hidden"'))
  if (look.gear === 'extend') parts.push(g(gear + anim(c, { attr: 'visibility', values: 'hidden;visible', keyTimes: '0;0.35', calcMode: 'discrete', dur: 2.8, isFrozen: true })))
  if (look.isPuffs) parts.push(sprite(PUFFS, BASE, PUFFS_AT[0], PUFFS_AT[1], anim(c, { attr: 'opacity', values: '1;.25;1', dur: 0.9, repeat: 'indefinite' })))

  return parts.join('')
}

function planeLayer(c: Ctx): string {
  const { k, L } = c
  if (k.pose === 'empty' || k.atGate) return g(planeBody(c, { isPilot: false, gear: 'down', prop: 'still', isPuffs: false }), at(L.gateX, L.parkY))
  if (k.pose === 'landed') return landedPlane(c)

  const x = k.planeX
  const y = L.cruiseY
  const move = k.move
  const isUturn = move?.kind === 'glide' && move.isUturn
  const prop: Prop = k.pose === 'paused' ? 'still' : k.pose === 'holding' ? 'blur' : 'spin'
  const isPuffs = k.pose === 'air' || k.pose === 'chop' || k.pose === 'storm'
  const gear = move?.kind === 'takeoff' ? 'retract' : 'up'
  let plane = g(planeBody(c, { isPilot: true, gear, prop, isPuffs }), ' transform="translate(-13 0)"')

  // Facing: a U-turn flies back facing left and turns right at the end; the
  // holding loop in "your turn" faces the way it flies.
  if (isUturn) plane = g(anim(c, { type: 'scale', values: '-1 1;1 1', keyTimes: '0;0.99', calcMode: 'discrete', dur: 1.4, isFrozen: true }) + plane)
  if (k.pose === 'ask') plane = g(anim(c, { type: 'scale', values: '1 1;-1 1;1 1', keyTimes: '0;0.25;0.75', calcMode: 'discrete', dur: 4, repeat: 'indefinite' }) + plane)

  // How it hangs in the air: bob, wobble, slow bob, or the holding loop.
  const motion: Partial<Record<ScenePose, Anim>> = {
    air: { type: 'translate', values: '0 0;0 -1;0 0;0 1', calcMode: 'discrete', dur: 1.6, repeat: 'indefinite' },
    chop: { type: 'translate', values: '0 0;1 -1;0 0;-1 1', calcMode: 'discrete', dur: 0.6, repeat: 'indefinite' },
    storm: { type: 'translate', values: '0 0;1 -1;-1 0;0 1;-1 -1', calcMode: 'discrete', dur: 0.5, repeat: 'indefinite' },
    holding: { type: 'translate', values: '0 0;0 -1', calcMode: 'discrete', dur: 2.4, repeat: 'indefinite' },
    ask: { type: 'translate', values: loopValues(), dur: 4, repeat: 'indefinite' },
  }
  const how = motion[k.pose]
  if (how !== undefined) plane = g(anim(c, how) + plane)

  const extra = k.pose === 'ask' ? askBubble(c, x) : ''

  let place = ''
  if (move?.kind === 'glide') {
    place = anim(c, { type: 'translate', values: `${move.fromX} ${y};${x} ${y}`, keyTimes: '0;1', keySplines: '.4 0 .2 1', calcMode: 'spline', dur: 1.4, isFrozen: true })
  } else if (move?.kind === 'takeoff') {
    const gx = L.gateX + 13
    const roll = Math.min(x - 4, gx + 22)
    place = anim(c, {
      type: 'translate',
      values: `${gx} ${L.parkY};${Math.max(gx, roll)} ${L.parkY};${x} ${y}`,
      keyTimes: '0;0.45;1',
      keySplines: '.5 0 1 1;0 0 .3 1',
      calcMode: 'spline',
      dur: 2.2,
      isFrozen: true,
    })
  }

  return g(place + plane, at(x, y)) + extra + (move?.kind === 'takeoff' ? takeoffDust(c) : '')
}

// The holding loop: a 28x6 racetrack around the plane's spot, 4 s a lap.
function loopValues(): string {
  const points: string[] = []
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI * 2 * i) / 12
    points.push(`${Math.round(Math.sin(a) * 14)} ${Math.round(Math.cos(a) * 3 - 1)}`)
  }

  return points.join(';')
}

function askBubble(c: Ctx, x: number): string {
  const { k } = c
  const bx = Math.min(k.W - 12, x + 15)
  const bob = anim(c, { type: 'translate', values: '0 0;0 -1', calcMode: 'discrete', dur: 1, repeat: 'indefinite', isAdditive: true })
  const by = Math.max(2, c.L.cruiseY - 10)
  const bubble = sprite(QUESTION, BASE, bx, by, bob)
  if (k.pop !== 'ask') return bubble
  // Pops in: scale 0 -> 1.2 -> 1 around its middle.
  const pop = anim(c, { type: 'scale', values: '0 0;1.2 1.2;1 1', keyTimes: '0;0.6;1', dur: 0.3, isFrozen: true })

  return g(g(pop + g(bubble, at(-bx - 4, -by - 4))), at(bx + 4, by + 4))
}

function takeoffDust(c: Ctx): string {
  const { L } = c
  const x = L.gateX + 20
  const y = L.runwayY - 1
  const dust = pixels(CREAM, [
    [x, y, 1, 1],
    [x + 4, y - 1, 1, 1],
    [x + 9, y, 1, 1],
  ])

  // Linear keyTimes must end at 1, or SMIL drops the animation.
  return g(dust + anim(c, { attr: 'opacity', values: '0;1;0;0', keyTimes: '0;0.3;0.6;1', dur: 2.2, isFrozen: true }), ' opacity="0"')
}

function landedPlane(c: Ctx): string {
  const { k, L } = c
  const sx = L.stopX
  const move = k.move
  if (move?.kind !== 'landing') return g(planeBody(c, { isPilot: false, gear: 'down', prop: 'still', isPuffs: false }), at(sx, L.parkY))
  const stopCx = sx + 13
  const touch = Math.max(move.fromX, stopCx - 8)
  const values = `${move.fromX} ${L.cruiseY};${touch} ${L.parkY};${Math.min(stopCx, touch + 3)} ${L.parkY - 2};${Math.min(stopCx, touch + 5)} ${L.parkY};${stopCx} ${L.parkY}`
  const descend = anim(c, { type: 'translate', values, keyTimes: '0;0.6;0.7;0.8;1', keySplines: '.3 0 .6 1;0 0 1 1;0 0 1 1;.2 0 .4 1', calcMode: 'spline', dur: 2.6, isFrozen: true })
  const body = planeBody(c, { isPilot: true, gear: 'extend', prop: 'stop', isPuffs: false })

  return g(descend + g(body, ' transform="translate(-13 0)"'), at(stopCx, L.parkY))
}

// ---------------------------------------------------------------- layers: weather, stamp, party, pause

function dim(c: Ctx, opacity: number): string {
  return rect(2, 2, c.k.W - 4, c.k.H - 4, DUSK_INK, ` opacity="${opacity}"`)
}

// Three failed runs in a row: a storm ahead of the plane, rain and a slow
// bolt (once per 2.6 s, under 1 Hz). It slides in when the storm starts.
function stormLayer(c: Ctx): string {
  const { k, L } = c
  const x = Math.max(4, Math.min(k.W - 24, k.planeX + 4))
  const drops: [number, number, number, number][] = []
  const top = Math.max(2, L.cruiseY - 9)
  ;[2, 7, 12, 17].forEach((dx, i) => {
    for (let y = top + 6 + (i % 2) * 3; y < L.routeY - 4; y += 6) drops.push([x + dx, y, 1, 2])
  })
  const rain = g(pixels(RAIN, drops) + anim(c, { type: 'translate', values: '0 0;0 2;0 4', calcMode: 'discrete', dur: 0.5, repeat: 'indefinite' }))
  const bolt = g(sprite(BOLT, BOLT_PALETTE, x + 10, top + 5) + blink(c, 2.6, 0.5, 0.62), c.k.isCalm ? '' : ' visibility="hidden"')
  const storm = sprite(STORM_CLOUD, STORM_PALETTE, x, top) + rain + bolt
  if (k.pop !== 'storm') return storm
  const slide = anim(c, { type: 'translate', values: `${k.W} 0;0 0`, keyTimes: '0;1', keySplines: '.2 0 .2 1', calcMode: 'spline', dur: 0.8, isFrozen: true })

  return g(slide + storm)
}

// Receipts: a green check badge slams onto the stop's pin, holds, fades.
function stampLayer(c: Ctx): string {
  const { k, L } = c
  const n = k.pins.length
  if (k.stamp < 0 || k.stamp >= n || k.isCalm) return ''
  const x = pinX(L, k.stamp, n)
  const y = L.routeY - 5
  const slam = anim(c, { type: 'scale', values: '2 2;1 1', keyTimes: '0;1', keySplines: '.5 0 .5 1', calcMode: 'spline', dur: 0.2, isFrozen: true })
  const fade = anim(c, { attr: 'opacity', values: '0;1;1;0', keyTimes: '0;0.08;0.8;1', dur: 2.4, isFrozen: true })

  return g(fade + g(slam + sprite(BADGE, BASE, -4, -4)), `${at(x, y)} opacity="0"`)
}

// Confetti: only for a party landing (every step checked, at least one with
// receipts, last run green). Four batches pop up around the captain and
// crew and fall back onto the grass, where a few stay after the party.
const CONFETTI_BITS: [number, number][] = [
  [2, 2],
  [1, 3],
  [3, 1],
]

// The pieces as they lie: the party pops them up and lets them fall back to
// exactly here, so the resting picture after it is pixel-identical.
function confettiPieces(c: Ctx, batch: number): string {
  const { k, L } = c
  const from = Math.max(4, L.stopX - 60)
  const span = Math.max(8, Math.min(k.W - 6, L.stopX + 30) - from)
  const out: string[] = []
  for (let i = 0; i < 6; i++) {
    const n = batch * 6 + i
    const x = from + ((n * 23 + batch * 7) % span)
    const y = L.feetY - 1 - ((n * 5) % 9)
    const [w, h] = CONFETTI_BITS[n % 3] ?? [2, 2]
    out.push(rect(x, y, w, h, CONFETTI_COLORS[n % CONFETTI_COLORS.length] ?? ORANGE))
  }

  return out.join('')
}

function confettiLayer(c: Ctx): string {
  const { k } = c
  if (k.pose !== 'landed' || k.landing !== 'party' || k.move?.kind !== 'landing' || k.isCalm) return ''
  const batches = [0, 1, 2, 3].map(batch => {
    const begin = 2.7 + batch * 0.18
    const height = [30, 24, 36, 27][batch] ?? 30
    const pop = anim(c, { type: 'translate', values: `0 0;0 -${height};0 0`, keyTimes: '0;0.35;1', keySplines: '.2 .7 .4 1;.6 0 .9 .5', calcMode: 'spline', dur: 1.5 + batch * 0.2, begin, isFrozen: true })
    // Sways, and freezes back at 0 so each piece lands where it rests.
    const sway = anim(c, { type: 'translate', values: '0 0;1 0;0 0;-1 0;0 0', keyTimes: '0;0.25;0.5;0.75;1', calcMode: 'discrete', dur: 0.4, begin, repeat: 4, isFrozen: true, isAdditive: true })

    return g(confettiPieces(c, batch) + pop + sway, ` transform="translate(0 ${k.H})"`)
  })

  return `<g id="confetti">${batches.join('')}</g>`
}

// After the party: what the pop left on the grass.
function confettiResting(c: Ctx): string {
  return `<g id="confetti">${[0, 1, 2, 3].map(batch => confettiPieces(c, batch)).join('')}</g>`
}

// Paused: the game pause screen. Everything stops, the sky dims, two bars,
// and one slow beacon on the plane's tail.
function pausedLayer(c: Ctx): string {
  const { k, L } = c
  // The bars (14 wide) sit beside the plane (x - 13 to x + 12), on its
  // roomier side with a 5-unit gap, never over it; in the strip they stay
  // above the pins.
  const isRight = k.W - 4 - (k.planeX + 13) >= k.planeX - 13 - 4
  const bx = isRight ? Math.min(k.W - 18, k.planeX + 18) : Math.max(4, k.planeX - 32)
  const bars = g(toPaths(PAUSE, BASE), ` transform="translate(${bx} ${k.isStrip ? 4 : 14}) scale(2)"`)
  const beacon = g(rect(k.planeX - 13 + TAIL_LIGHT[0], L.cruiseY + TAIL_LIGHT[1] - 1, 1, 1, RED) + blink(c, 2, 0, 0.5))

  return dim(c, 0.35) + bars + beacon
}

function frame(c: Ctx): string {
  const { W, H } = c.k

  return `<path fill="${INK}" fill-rule="evenodd" d="${outline(W, H, 0)}${outline(W, H, 1)}"/><path fill="${CREAM}" fill-rule="evenodd" d="${outline(W, H, 1)}${outline(W, H, 2)}"/>`
}

// ---------------------------------------------------------------- the picture

function draw(k: SceneKey): string {
  const L = layoutOf(k.W, k.H, k.isStrip)
  const c: Ctx = { k, L, sky: SKIES[k.bucket] }
  const body = [
    skyLayer(c),
    k.move?.kind === 'takeoff' ? dawnFade(c) : '',
    sunLayer(c),
    farClouds(c),
    k.isStrip ? '' : hillsLayer(c) + nearClouds(c),
    k.isStrip ? stripGround(c) : groundLayer(c),
    k.pose === 'storm' ? dim(c, 0.25) : '',
    routeLayer(c),
    pinsLayer(c),
    k.isStrip ? '' : figures(c),
    k.pose === 'storm' ? stormLayer(c) : '',
    planeLayer(c),
    stampLayer(c),
    k.pose === 'paused' ? pausedLayer(c) : '',
    frame(c),
  ].join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${k.W * k.scale}" height="${k.H * k.scale}" viewBox="0 0 ${k.W} ${k.H}" shape-rendering="crispEdges">${body}</svg>`
}

// Same key, same string: a redraw for anything else (activity text, the
// countdown, an open editor) hands the frame a byte-identical source, so
// the animation keeps running.
const MEMO = new Map<string, string>()

export function sceneSvg(key: SceneKey): string {
  const id = JSON.stringify(key)
  const hit = MEMO.get(id)
  if (hit !== undefined) {
    MEMO.delete(id)
    MEMO.set(id, hit)

    return hit
  }
  const svg = draw(key)
  MEMO.set(id, svg)
  if (MEMO.size > 24) {
    const oldest = MEMO.keys().next().value
    if (oldest !== undefined) MEMO.delete(oldest)
  }

  return svg
}

// ---------------------------------------------------------------- words about the picture

// Plain words for screen readers, from the key only (never voiced).
export function sceneAlt(key: SceneKey): string {
  const n = key.pins.length
  const at = key.pins.findIndex(pin => pin.state === 'current')
  const pin = key.pins[at]
  const where = pin !== undefined ? `stop ${at + 1} of ${n} (${pin.sign})` : 'the next stop'
  const what: Record<ScenePose, string> = {
    empty: 'the plane waits at the gate with the captain (Claude). No route yet.',
    boarding: `boarding at the gate, ${n} ${n === 1 ? 'stop' : 'stops'} on the route.`,
    ground: `on hold at the gate, ${n} ${n === 1 ? 'stop' : 'stops'} on the route.`,
    air: `flying to ${where}.`,
    chop: `a bumpy patch on the way to ${where}.`,
    storm: `flying through a storm: tests keep failing on the way to ${where}.`,
    ask: key.atGate ? 'the captain (Claude) has a question before take-off.' : `circling near ${where} until you answer.`,
    holding: `holding near ${where}.`,
    paused: `paused near ${where}.`,
    // A party may count the person's sign-offs (R6): "checked", not "by tests".
    landed: key.landing === 'party' ? 'landed, every step checked.' : key.landing === 'amber' ? 'landed with failing tests.' : 'landed, some steps not tested yet.',
  }
  const verified = key.pins.filter(one => one.state === 'verified').length
  const parts = [`Flight Plan sky, ${clockLabel(key.minutes)}: ${what[key.pose]}`]
  if (n > 0 && key.pose !== 'empty') parts.push(`${verified} of ${n} ${n === 1 ? 'stop' : 'stops'} checked.`)
  const working = key.crew.filter(one => !one.isBack).length + key.extraCrew
  const back = key.crew.filter(one => one.isBack).length
  if (working > 0 || back > 0) parts.push(`Crew: ${working} working, ${back} back.`)
  const alt = parts.join(' ')

  return alt.length <= 200 ? alt : `${alt.slice(0, 199)}…`
}

// The signs row under the sky: a whole-cell left spacer, N equal shares and
// a right spacer, so each sign sits under its pin (within a cell). `cells`
// is the row's width; it starts at the sky's left edge. A cell is 8 px.
export function signCells(key: SceneKey, cells: number): { left: number; right: number } {
  const L = layoutOf(key.W, key.H, key.isStrip)
  const perUnit = key.scale / 8
  const left = Math.max(0, Math.round(L.x0 * perUnit))
  const right = Math.max(0, Math.floor(cells) - Math.round(L.x1 * perUnit))
  if (key.pins.length === 0 || left + right >= cells) return { left: 0, right: 0 }

  return { left, right }
}
