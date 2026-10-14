import { describe, expect, test } from 'claude-code/testing'

import { applySet, applyStep, userEdit } from '../hooks/model'
import { ONE_SHOT_MS, clockOf, sceneAlt, sceneKey, sceneSize, sceneSvg, signCells, signOf, stopsOf } from '../hooks/scene'
import type { SceneKey, ScenePose } from '../hooks/scene'
import type { Live, Route, Step, StepStatus } from '../types'

// The pixel sky, pure: same input, same picture; small, safe and well
// formed in every pose and size; one-shots only inside their windows; the
// clock and the confetti only on what really happened.

const NOW = 5_000_000

type Shape = {
  stops?: number
  per?: number
  /** [stop, step] the plane is on; steps before it are closed. */
  at?: [number, number]
  /** Stops before `at` whose steps all have receipts. */
  verified?: number
  gate?: Route['gate']
  isPaused?: boolean
  landedAt?: number
  isAllChecked?: boolean
  takeoffAt?: number
  movedAt?: number
  planeFrom?: string | null
  checked?: { id: string; at: number }
  failedTests?: number
  testsAt?: number
  titles?: string[]
}

function flight(shape: Shape = {}): Route {
  const stops = shape.stops ?? 4
  const per = shape.per ?? 2
  const at = shape.at ?? [Math.min(1, Math.max(0, stops - 1)), 0]
  const verified = shape.verified ?? 1
  const isLanded = (shape.landedAt ?? 0) > 0
  const steps: Step[] = []
  const features = Array.from({ length: stops }, (_, i) => ({ id: `f${i + 1}`, title: shape.titles?.[i] ?? `Stop number ${i + 1}`, why: '' }))
  features.forEach((feature, i) => {
    for (let j = 0; j < per; j++) {
      const id = `s${i + 1}-${j + 1}`
      const isBefore = i < at[0] || (i === at[0] && j < at[1])
      let status: StepStatus = 'pending'
      if (isBefore || isLanded) status = i < verified || shape.isAllChecked === true ? 'checked' : 'done'
      if (!isLanded && i === at[0] && j === at[1]) status = 'active'
      const step: Step = { id, featureId: feature.id, title: `Step ${j + 1}`, why: '', files: [], check: 'node --test', status, written: [] }
      if (status === 'checked') step.doneBy = 'seen'
      if (shape.checked?.id === id) step.checkedAt = shape.checked.at
      steps.push(step)
    }
  })
  const last = steps[steps.length - 1]
  const plane = stops === 0 ? null : isLanded ? (last?.id ?? null) : `s${at[0] + 1}-${at[1] + 1}`

  return {
    version: 1,
    goal: 'Demo',
    features,
    steps,
    decisions: [],
    edits: [],
    plane,
    doing: '',
    movedAt: shape.movedAt ?? NOW - 60_000,
    planeFrom: shape.planeFrom,
    takeoffAt: shape.takeoffAt ?? NOW - 600_000,
    setAt: NOW - 700_000,
    lastClaudeAt: NOW,
    gate: shape.gate ?? 'go',
    isPaused: shape.isPaused ?? false,
    landedAt: shape.landedAt ?? 0,
    addedAt: 0,
    addedCount: 0,
    nextEdit: 1,
    tests: { passed: 4, failed: shape.failedTests ?? 0, at: shape.testsAt ?? NOW - 30_000, command: 'node --test' },
    files: [],
  }
}

function liveOf(change: Partial<Live> = {}): Live {
  return {
    isRunning: true,
    turnId: 't1',
    turnStartedAt: NOW - 90_000,
    activity: 'Editing a file',
    activityAt: NOW - 1000,
    lastCommand: 'node --test',
    waiting: null,
    errorsInRow: 0,
    failedRuns: 0,
    helpers: [],
    celebrateUntil: 0,
    cost: 0.42,
    contextPercent: 31,
    heldTurnEnd: false,
    ...change,
  }
}

const crewOf = (n: number): Live['helpers'] => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, description: 'help', isDone: i === 1, startedAt: NOW - 20_000 }))

// One state per pose (and the three landings), with n stops and c crew.
function stateOf(pose: string, stops: number, crew: number, shape: Shape = {}): { route: Route | null; live: Live } {
  const helpers = crewOf(crew)
  const n = Math.max(1, stops)
  const base = { ...shape, stops: n }
  switch (pose) {
    case 'empty':
      return { route: stops === 0 ? null : flight({ ...base, per: 0 }), live: liveOf({ isRunning: false, helpers }) }
    case 'ground':
      return { route: flight({ ...base, gate: 'held', at: [0, 0], verified: 0 }), live: liveOf({ isRunning: false, helpers }) }
    case 'boarding':
      return { route: flight({ ...base, gate: 'waiting', at: [0, 0], verified: 0 }), live: liveOf({ isRunning: false, helpers }) }
    case 'ask':
      return { route: flight(base), live: liveOf({ waiting: { question: 'Which one?', toolUseId: 'q1' }, helpers }) }
    case 'holding':
      return { route: flight(base), live: liveOf({ isRunning: false, helpers }) }
    case 'paused':
      return { route: flight({ ...base, isPaused: true }), live: liveOf({ isRunning: false, helpers }) }
    case 'chop':
      return { route: flight(base), live: liveOf({ failedRuns: 2, helpers }) }
    case 'storm':
      return { route: flight({ ...base, failedTests: 2 }), live: liveOf({ failedRuns: 3, helpers }) }
    case 'party':
      return { route: flight({ ...base, isAllChecked: true, landedAt: shape.landedAt ?? NOW - 600_000 }), live: liveOf({ isRunning: false, helpers }) }
    case 'quiet':
      return { route: flight({ ...base, verified: 0, landedAt: shape.landedAt ?? NOW - 600_000 }), live: liveOf({ isRunning: false, helpers }) }
    case 'amber':
      return { route: flight({ ...base, verified: 0, failedTests: 1, landedAt: shape.landedAt ?? NOW - 600_000 }), live: liveOf({ isRunning: false, helpers }) }
    default:
      return { route: flight(base), live: liveOf({ helpers }) }
  }
}

const POSES = ['empty', 'ground', 'boarding', 'air', 'ask', 'holding', 'paused', 'chop', 'storm', 'party', 'quiet', 'amber']

function keyOf(route: Route | null, live: Live, more: { now?: number; columns?: number; isStrip?: boolean; isCalm?: boolean } = {}): SceneKey {
  return sceneKey({ route, live, now: more.now ?? NOW, columns: more.columns ?? 63, isStrip: more.isStrip ?? false, isCalm: more.isCalm ?? false })
}

// ---------------------------------------------------------------- markup checks

const FORBIDDEN = [
  /<script/i,
  /\son[a-z]+\s*=/i,
  /href/i,
  /<use\b/,
  /<pattern\b/,
  /<clipPath\b/,
  /<mask\b/,
  /<filter\b/,
  /<style\b/,
  /\bstyle=/,
  /<text\b/,
  /<image\b/,
  /<foreignObject\b/,
  /<animateMotion\b/,
  /<set\b/,
  /begin="-/,
  /wallclock/,
  /@keyframes/,
  /NaN/,
  /undefined/,
]
const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'title', 'animate', 'animateTransform'])

// Every tag allowed, every open tag closed in order (a stack parser).
function problemsOf(svg: string): string[] {
  const problems: string[] = []
  for (const rule of FORBIDDEN) if (rule.test(svg)) problems.push(`forbidden ${rule}`)
  const stack: string[] = []
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, close, name = '', self] = match
    if (!ALLOWED_TAGS.has(name)) problems.push(`tag <${name}>`)
    if (self === '/') continue
    if (close === '/') {
      if (stack.pop() !== name) problems.push(`unbalanced </${name}>`)
    } else stack.push(name)
  }
  if (stack.length > 0) problems.push(`unclosed ${stack.join(',')}`)
  // Coordinates are whole art pixels (values lists may hold fractions).
  for (const match of svg.matchAll(/\s(x|y|width|height|d)="([^"]*)"/g)) {
    if (/\d\.\d/.test(match[2] ?? '')) problems.push(`fraction in ${match[1]}="${match[2]}"`)
  }
  for (const match of svg.matchAll(/translate\(([^)]*)\)/g)) {
    if (/\./.test(match[1] ?? '')) problems.push(`fraction in translate(${match[1]})`)
  }
  for (const match of svg.matchAll(/<animate attributeName="([a-z]+)"/g)) {
    if (!['opacity', 'visibility', 'fill'].includes(match[1] ?? '')) problems.push(`animate ${match[1]}`)
  }
  for (const match of svg.matchAll(/<animateTransform attributeName="transform" type="([a-z]+)"/g)) {
    if (!['translate', 'scale', 'rotate'].includes(match[1] ?? '')) problems.push(`animateTransform ${match[1]}`)
  }
  // SMIL drops a linear or spline animation whose keyTimes do not run from
  // 0 to 1, one per value.
  for (const match of svg.matchAll(/<animate(?:Transform)?\b[^>]*>/g)) {
    const tag = match[0]
    const keyTimes = tag.match(/keyTimes="([^"]*)"/)?.[1]
    if (keyTimes === undefined || /calcMode="discrete"/.test(tag)) continue
    const times = keyTimes.split(';')
    const values = tag.match(/values="([^"]*)"/)?.[1]?.split(';') ?? []
    if (times[0] !== '0' || times[times.length - 1] !== '1' || times.length !== values.length) problems.push(`keyTimes ${tag}`)
  }

  return problems
}

const animations = (svg: string) => (svg.match(/<animate(Transform)?\b/g) ?? []).length
const titles = (svg: string) => (svg.match(/<title>/g) ?? []).length

function expectSafe(svg: string, isCalm: boolean, label: string) {
  expect({ label, problems: problemsOf(svg) }).toEqual({ label, problems: [] })
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg.length).toBeLessThanOrEqual(32768)
  expect(animations(svg)).toBeLessThanOrEqual(isCalm ? 0 : 40)
  expect(titles(svg)).toBeLessThanOrEqual(12)
}

// ---------------------------------------------------------------- tests

describe('the sky is byte-stable', () => {
  test('the same key draws the same string, memo or not', () => {
    const { route, live } = stateOf('air', 4, 2)
    const key = keyOf(route, live)
    const copy = JSON.parse(JSON.stringify(key)) as SceneKey
    expect(sceneSvg(copy)).toBe(sceneSvg(key))
    expect(sceneAlt(copy)).toBe(sceneAlt(key))
    // Drawn again after the memo has moved on (more than 24 other keys).
    for (let columns = 40; columns < 70; columns++) sceneSvg(keyOf(route, live, { columns }))
    expect(sceneSvg(copy)).toBe(sceneSvg(key))
  })

  test('activity, its time, the last command, cost and context never change the key', () => {
    for (const pose of POSES) {
      const { route, live } = stateOf(pose, 4, 2)
      const busy = { ...live, activity: 'Running the tests', activityAt: NOW - 3, lastCommand: 'npm test', cost: 9.99, contextPercent: 88 }
      expect(JSON.stringify(keyOf(route, busy))).toBe(JSON.stringify(keyOf(route, live)))
    }
  })

  test('outside every window, time passing changes nothing', () => {
    for (const pose of POSES) {
      const { route, live } = stateOf(pose, 4, 1)
      expect(JSON.stringify(keyOf(route, live, { now: NOW + 90_000 }))).toBe(JSON.stringify(keyOf(route, live)))
    }
  })

  test('the key holds no timestamps', () => {
    const { route, live } = stateOf('air', 4, 2, { movedAt: NOW - 100, planeFrom: 's2-1', checked: { id: 's1-2', at: NOW - 100 } })
    const numbers = JSON.stringify(keyOf(route, live)).match(/-?\d+(\.\d+)?/g) ?? []
    for (const number of numbers) expect(Math.abs(Number(number))).toBeLessThan(10_000)
  })
})

describe('the sky is small, safe and well formed', () => {
  test('every pose x width x stops x crew, banner and strip', () => {
    for (const pose of POSES) {
      for (const columns of [30, 63, 100]) {
        for (let stops = 0; stops <= 8; stops++) {
          for (let crew = 0; crew <= 3; crew++) {
            for (const isStrip of [false, true]) {
              const { route, live } = stateOf(pose, stops, crew)
              const key = keyOf(route, live, { columns, isStrip })
              expectSafe(sceneSvg(key), false, `${pose} ${columns} ${stops} ${crew} ${isStrip}`)
              expect(sceneAlt(key).length).toBeLessThanOrEqual(200)
            }
          }
        }
      }
    }
  })

  test('every one-shot inside its window, at every width, and calm draws no animation at all', () => {
    const shots: [string, Shape, Partial<Live>][] = [
      ['air', { at: [0, 0], verified: 0, takeoffAt: NOW - 100, movedAt: NOW - 100, planeFrom: null }, {}],
      ['air', { at: [1, 1], movedAt: NOW - 100, planeFrom: 's2-1' }, {}],
      ['air', { at: [1, 0], movedAt: NOW - 100, planeFrom: 's3-1' }, {}],
      ['air', { at: [2, 0], verified: 2, checked: { id: 's2-2', at: NOW - 100 } }, {}],
      ['storm', { testsAt: NOW - 100 }, {}],
      ['ask', {}, { waiting: { question: 'Which?', toolUseId: 'q', at: NOW - 100 } as Live['waiting'] }],
      ['party', { landedAt: NOW - 100 }, {}],
      ['quiet', { landedAt: NOW - 100 }, {}],
      ['amber', { landedAt: NOW - 100 }, {}],
    ]
    for (const [pose, shape, change] of shots) {
      for (const columns of [30, 63, 100]) {
        for (const stops of [1, 4, 8]) {
          for (const crew of [0, 3]) {
            const state = stateOf(pose, stops, crew, shape)
            const live = { ...state.live, ...change }
            for (const isStrip of [false, true]) {
              for (const isCalm of [false, true]) {
                const key = keyOf(state.route, live, { columns, isStrip, isCalm })
                expectSafe(sceneSvg(key), isCalm, `${pose} ${JSON.stringify(shape)} ${columns} ${stops} ${crew} ${isStrip} ${isCalm}`)
              }
            }
          }
        }
      }
    }
  })

  test('the biggest route: 8 stops, 12 steps, 60-character titles, 3 crew and more', () => {
    const title = (i: number) => `Make the ${i}th stop of this flight work for everyone, please`.padEnd(60, '.').slice(0, 60)
    const route = flight({ stops: 8, per: 2, at: [5, 0], verified: 3, titles: Array.from({ length: 8 }, (_, i) => title(i)) })
    route.steps = route.steps.filter(step => !/^s[5-8]-2$/.test(step.id))
    expect(route.steps).toHaveLength(12)
    for (const pose of ['air', 'storm', 'party']) {
      const live = liveOf({ helpers: crewOf(5), failedRuns: pose === 'storm' ? 3 : 0, isRunning: pose !== 'party' })
      const landed = pose === 'party' ? { ...route, landedAt: NOW - 100, steps: route.steps.map(step => ({ ...step, status: 'checked' as const, doneBy: 'seen' as const })) } : route
      for (const columns of [30, 63, 100, 200]) {
        const svg = sceneSvg(keyOf(landed, live, { columns }))
        expectSafe(svg, false, `big ${pose} ${columns}`)
        expect(titles(svg)).toBe(8)
      }
    }
  })

  test('titles are escaped and only ever inside <title>', () => {
    const route = flight({ stops: 3, titles: ['</svg><script>&"', 'ok', `it's <b>`] })
    const svg = sceneSvg(keyOf(route, liveOf()))
    expect(svg).not.toContain('<script')
    expect(svg).toContain('&lt;/svg&gt;&lt;script&gt;&amp;&quot;')
    expect(svg).toContain('it&#39;s &lt;b&gt;')
    expect(problemsOf(svg)).toEqual([])
  })
})

describe('one-shots play only inside their windows', () => {
  const at = (route: Route | null, live: Live, now: number) => keyOf(route, live, { now })

  test('take-off, glide and U-turn come from the persisted move times', () => {
    const takeoff = flight({ at: [0, 0], verified: 0, takeoffAt: NOW, movedAt: NOW, planeFrom: null })
    expect(at(takeoff, liveOf(), NOW + 100).move).toEqual({ kind: 'takeoff' })
    expect(at(takeoff, liveOf(), NOW + ONE_SHOT_MS.takeoff - 1).move).toEqual({ kind: 'takeoff' })
    expect(at(takeoff, liveOf(), NOW + ONE_SHOT_MS.takeoff).move).toBe(null)

    const glide = flight({ at: [1, 1], movedAt: NOW, planeFrom: 's2-1' })
    expect(at(glide, liveOf(), NOW + 100).move).toMatchObject({ kind: 'glide', isUturn: false })
    expect(at(glide, liveOf(), NOW + ONE_SHOT_MS.glide).move).toBe(null)

    const back = flight({ at: [0, 1], movedAt: NOW, planeFrom: 's3-1' })
    expect(at(back, liveOf(), NOW + 100).move).toMatchObject({ kind: 'glide', isUturn: true })
    expect(sceneSvg(at(back, liveOf(), NOW + 100))).toContain('type="scale" values="-1 1;1 1"')
    expect(sceneSvg(at(back, liveOf(), NOW + ONE_SHOT_MS.glide))).not.toContain('values="-1 1;1 1"')
  })

  test('the receipts stamp lands on its stop for 2.5 s', () => {
    const route = flight({ at: [2, 0], verified: 2, checked: { id: 's2-2', at: NOW } })
    expect(at(route, liveOf(), NOW + 100).stamp).toBe(1)
    expect(at(route, liveOf(), NOW + ONE_SHOT_MS.stamp - 1).stamp).toBe(1)
    expect(at(route, liveOf(), NOW + ONE_SHOT_MS.stamp).stamp).toBe(-1)
    // "I checked it" is never receipts: no stamp.
    const vouched = flight({ at: [2, 0], verified: 2, checked: { id: 's2-2', at: NOW } })
    const step = vouched.steps.find(one => one.id === 's2-2')
    if (step !== undefined) step.doneBy = 'you'
    expect(at(vouched, liveOf(), NOW + 100).stamp).toBe(-1)
  })

  test('the storm slides in once, on the third failed run', () => {
    const { route, live } = stateOf('storm', 4, 0, { testsAt: NOW })
    expect(at(route, live, NOW + 100).pop).toBe('storm')
    expect(at(route, live, NOW + ONE_SHOT_MS.storm).pop).toBe(null)
    expect(at(route, { ...live, failedRuns: 4 }, NOW + 100).pop).toBe(null)
  })

  test('a landing plays once: party 6 s, quiet and amber 3 s, and never replays', () => {
    for (const [pose, window] of [
      ['party', ONE_SHOT_MS.landingParty],
      ['quiet', ONE_SHOT_MS.landingQuiet],
      ['amber', ONE_SHOT_MS.landingQuiet],
    ] as const) {
      const { route, live } = stateOf(pose, 4, 2, { landedAt: NOW })
      expect(at(route, live, NOW + 100).move?.kind).toBe('landing')
      expect(at(route, live, NOW + window - 1).move?.kind).toBe('landing')
      const after = sceneSvg(at(route, live, NOW + window))
      expect(at(route, live, NOW + window).move).toBe(null)
      // Redrawn much later (a remount, a new pane): the same still picture.
      expect(sceneSvg(at(route, live, NOW + 3_600_000))).toBe(after)
      expect(after).not.toContain('keyTimes="0;0.6;0.7;0.8;1"')
    }
  })

  test('confetti, cheering and the falling pop only for a party landing', () => {
    for (const pose of ['party', 'quiet', 'amber']) {
      for (const now of [NOW + 100, NOW + 2000, NOW + 10_000]) {
        const { route, live } = stateOf(pose, 4, 2, { landedAt: NOW })
        const svg = sceneSvg(at(route, live, now))
        expect(svg.includes('id="confetti"')).toBe(pose === 'party')
        // The cheer: four rounds of stand and cheer frames.
        expect(svg.includes('repeatCount="4"')).toBe(pose === 'party' && now < NOW + ONE_SHOT_MS.landingParty)
      }
    }
    // No landing, no confetti, whatever else happened.
    for (const pose of POSES.slice(0, 9)) {
      const { route, live } = stateOf(pose, 4, 3, { checked: { id: 's1-2', at: NOW - 10 } })
      expect(sceneSvg(at(route, { ...live, celebrateUntil: NOW + 5000 }, NOW))).not.toContain('confetti')
    }
  })

  test('one-shots that start together end together, so none restarts halfway', () => {
    // The test run that checks a step also moves the plane: glide 1.6 s, stamp 2.5 s.
    const route = flight({ at: [2, 0], verified: 2, movedAt: NOW, planeFrom: 's2-2', checked: { id: 's2-2', at: NOW } })
    const first = keyOf(route, liveOf(), { now: NOW + 100 })
    expect(first.move?.kind).toBe('glide')
    expect(first.stamp).toBe(1)
    // After the glide's own window the picture must not change (a new source
    // would replay the stamp): the glide stays, frozen at its end.
    expect(JSON.stringify(keyOf(route, liveOf(), { now: NOW + 2000 }))).toBe(JSON.stringify(first))
    const after = keyOf(route, liveOf(), { now: NOW + ONE_SHOT_MS.stamp })
    expect([after.move, after.stamp]).toEqual([null, -1])
  })

  test('something new happening drops a running one-shot instead of replaying it', () => {
    const route = flight({ at: [2, 0], verified: 2, checked: { id: 's2-2', at: NOW } })
    expect(keyOf(route, liveOf(), { now: NOW + 500 }).stamp).toBe(1)
    const helper = { id: 'h1', description: 'look', isDone: false, startedAt: NOW + 1000 }
    expect(keyOf(route, liveOf({ helpers: [helper] }), { now: NOW + 1100 }).stamp).toBe(-1)
  })

  test('idle scenes run at most two slow loops (R24)', () => {
    for (const pose of ['empty', 'ground', 'holding', 'paused', 'party', 'quiet', 'amber']) {
      for (const columns of [30, 63, 100]) {
        const { route, live } = stateOf(pose, 4, 3)
        const svg = sceneSvg(keyOf(route, live, { columns }))
        expect({ pose, loops: (svg.match(/repeatCount="indefinite"/g) ?? []).length <= 2 }).toEqual({ pose, loops: true })
        for (const match of svg.matchAll(/dur="([\d.]+)s"[^>]*repeatCount="indefinite"/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(1.5)
      }
    }
  })

  test('calm keys carry no one-shots', () => {
    const route = flight({ at: [1, 1], movedAt: NOW, planeFrom: 's2-1', checked: { id: 's1-2', at: NOW } })
    const key = keyOf(route, liveOf(), { now: NOW + 10, isCalm: true })
    expect(key.move).toBe(null)
    expect(key.stamp).toBe(-1)
    expect(animations(sceneSvg(key))).toBe(0)
  })
})

describe('the sky clock (R2)', () => {
  test('fixed times: empty 5:30 AM, at the gate 5:45 AM, landed 7:00 PM', () => {
    expect(clockOf(null)).toEqual({ minutes: 330, label: '5:30 AM', bucket: 'predawn' })
    expect(clockOf(flight({ stops: 2, per: 0 })).label).toBe('5:30 AM')
    expect(clockOf(flight({ gate: 'waiting', at: [0, 0] }))).toEqual({ minutes: 345, label: '5:45 AM', bucket: 'predawn' })
    expect(clockOf(flight({ gate: 'held', at: [0, 0] })).label).toBe('5:45 AM')
    expect(clockOf(flight({ landedAt: NOW, isAllChecked: true }))).toEqual({ minutes: 1140, label: '7:00 PM', bucket: 'dusk' })
  })

  test('in the air: 6:00 AM plus 780 minutes x closed/live, capped at 6:40 PM', () => {
    expect(clockOf(flight({ at: [0, 0] }))).toEqual({ minutes: 360, label: '6:00 AM', bucket: 'dawn' })
    expect(clockOf(flight({ stops: 4, per: 1, at: [1, 0] }))).toEqual({ minutes: 555, label: '9:15 AM', bucket: 'morning' })
    expect(clockOf(flight({ stops: 4, per: 1, at: [2, 0] })).label).toBe('12:30 PM')
    expect(clockOf(flight({ stops: 3, per: 1, at: [1, 0] })).minutes).toBe(360 + 260)
    const allClosed = flight({ stops: 2, per: 1, at: [1, 1] })
    expect(allClosed.steps.every(step => step.status === 'checked' || step.status === 'done')).toBe(true)
    expect(clockOf(allClosed)).toEqual({ minutes: 1120, label: '6:40 PM', bucket: 'golden' })
  })

  test('it never moves on a step that is not closed, and goes back when the route grows', () => {
    const route = flight({ stops: 2, per: 2, at: [0, 1] })
    const before = clockOf(route).minutes
    for (const status of ['active', 'failed', 'blocked', 'pending', 'removed'] as const) {
      const one = flight({ stops: 2, per: 2, at: [0, 1] })
      const step = one.steps.find(s => s.id === 's2-1')
      if (step !== undefined) step.status = status === 'removed' ? 'pending' : status
      expect(clockOf(one).minutes).toBe(before)
    }
    for (const status of ['done', 'checked', 'skipped'] as const) {
      const one = flight({ stops: 2, per: 2, at: [0, 1] })
      const step = one.steps.find(s => s.id === 's2-1')
      if (step !== undefined) step.status = status
      expect(clockOf(one).minutes).toBeGreaterThan(before)
    }
    const grown = flight({ stops: 2, per: 2, at: [0, 1] })
    grown.steps.push({ id: 'new', featureId: 'f2', title: 'More', why: '', files: [], check: '', status: 'pending', written: [] })
    expect(clockOf(grown).minutes).toBeLessThan(before)
  })

  test('the sun climbs only with the clock: same closed steps, same sky', () => {
    const a = keyOf(flight({ at: [1, 0] }), liveOf())
    const b = keyOf(flight({ at: [1, 0] }), liveOf({ isRunning: false }))
    expect([a.minutes, a.bucket]).toEqual([b.minutes, b.bucket])
  })
})

describe('signs and pins', () => {
  test('signOf: drops lead-in words, keeps 8 characters, any script, falls back to "stop n"', () => {
    expect(signOf('Let people log in with Google', 0)).toBe('log in')
    expect(signOf('Keep a to-do list', 1)).toBe('to-do')
    expect(signOf('Add the README', 2)).toBe('README')
    expect(signOf('Set up CI', 3)).toBe('CI')
    expect(signOf('Internationalization everywhere', 0)).toBe('Internat')
    expect(signOf('', 0)).toBe('stop 1')
    expect(signOf('   ', 4)).toBe('stop 5')
    expect(signOf('!!! ???', 2)).toBe('stop 3')
    expect(signOf('Add the', 6)).toBe('stop 7')
    expect(signOf('Sync and share', 0)).toBe('Sync')
    for (const title of ['日本語のサポートを追加する', 'Добавить вход через Google', '🚀🚀🚀🚀🚀🚀 launch', 'إضافة تسجيل الدخول', 'a'.repeat(200)]) {
      const sign = signOf(title, 0)
      expect(sign.length).toBeGreaterThan(0)
      expect(sign.length).toBeLessThanOrEqual(8)
      expect(/[\uD800-\uDBFF]$/.test(sign)).toBe(false)
    }
  })

  test('stopsOf: stops with a live step, or one you proposed; at most 8', () => {
    const route = flight({ stops: 10, per: 1 })
    expect(stopsOf(route)).toHaveLength(8)
    const some = flight({ stops: 3, per: 1 })
    some.steps = some.steps.filter(step => step.featureId !== 'f2')
    some.features.push({ id: 'fy', title: 'Yours', why: '', proposedBy: 'you' })
    expect(stopsOf(some).map(feature => feature.id)).toEqual(['f1', 'f3', 'fy'])
  })

  test('signCells: whole-cell spacers, and N equal shares line up with the pins within a cell', () => {
    for (const columns of [30, 46, 63, 80, 100, 140]) {
      for (const isStrip of [false, true]) {
        for (let n = 1; n <= 8; n++) {
          const route = flight({ stops: n, per: 1, at: [0, 0], gate: 'waiting', verified: 0 })
          const key = keyOf(route, liveOf({ isRunning: false }), { columns, isStrip })
          const { cells, scale } = sceneSize(columns, isStrip)
          const { left, right } = signCells(key, cells)
          expect(Number.isInteger(left) && Number.isInteger(right)).toBe(true)
          expect(left).toBeGreaterThanOrEqual(0)
          expect(right).toBeGreaterThanOrEqual(0)
          expect(left + right).toBeLessThan(cells)
          // Each pin's tip column, read back from the picture.
          const svg = sceneSvg(key)
          // A pin's sprite starts with its ink head: '..KKK..' (tip at 3) or
          // the mini '.KKK.' (tip at 2).
          const pins = [...svg.matchAll(/<title>[^<]*<\/title><g transform="translate\((\d+) \d+\)"><path fill="#2B1D16" d="M(\d) 0h3/g)]
          expect(pins).toHaveLength(n)
          const share = (cells - left - right) / n
          pins.forEach((match, i) => {
            const tip = Number(match[1]) + (match[2] === '2' ? 3 : 2)
            const pin = ((tip + 0.5) * scale) / 8
            const sign = left + (i + 0.5) * share
            expect(Math.abs(pin - sign)).toBeLessThanOrEqual(1)
          })
        }
      }
    }
    const empty = keyOf(null, liveOf())
    expect(signCells(empty, 61)).toEqual({ left: 0, right: 0 })
  })
})

describe('the plane and the sky tell the truth', () => {
  test('the plane only flies backward for a redo, and the key says U-turn', () => {
    const plan = {
      op: 'set',
      goal: 'Demo',
      features: [1, 2, 3].map(i => ({ id: `f${i}`, title: `Stop ${i}`, why: '', steps: [1, 2].map(j => ({ id: `s${i}${j}`, title: `Step ${j}`, why: '', files: [`f${i}${j}.js`], check: 'node --test' })) })),
    }
    const route = applySet(null, plan, 1000, { departure: 'go', countdownSeconds: 30, isApproved: true }).route
    const live = liveOf()
    const order = ['s11', 's12', 's21', 's22', 's31']
    let last = keyOf(route, live, { now: 1000 }).planeX
    let t = 2000
    for (const id of order) {
      t += 10_000
      applyStep(route, { op: 'step', start: id, finish: order[order.indexOf(id) - 1] ?? [] }, t)
      for (const now of [t + 100, t + 5000]) {
        const key = keyOf(route, live, { now })
        expect(key.planeX).toBeGreaterThanOrEqual(last)
        if (key.move?.kind === 'glide') expect(key.move.isUturn).toBe(false)
        last = key.planeX
      }
    }
    // Claude claiming an earlier step over open work does not move it back.
    route.steps.forEach(step => {
      if (step.id === 's31') step.written = ['f31.js']
    })
    applyStep(route, { op: 'step', start: 's21' }, (t += 10_000))
    expect(keyOf(route, live, { now: t + 100 }).planeX).toBe(last)
    // A redo does, with a U-turn.
    userEdit(route, 'redo', 's12', 'try again', (t += 10_000))
    applyStep(route, { op: 'step', start: 's12' }, (t += 10_000))
    const back = keyOf(route, live, { now: t + 100 })
    expect(back.planeX).toBeLessThan(last)
    expect(back.move).toMatchObject({ kind: 'glide', isUturn: true })
    expect(keyOf(route, live, { now: t + ONE_SHOT_MS.glide }).move).toBe(null)
  })

  test('poses come from state only (R10)', () => {
    const pose = (name: string, stops = 4): ScenePose => keyOf(stateOf(name, stops, 0).route, stateOf(name, stops, 0).live).pose
    expect(pose('empty', 0)).toBe('empty')
    expect(pose('ground')).toBe('ground')
    expect(pose('boarding')).toBe('boarding')
    expect(pose('air')).toBe('air')
    expect(pose('ask')).toBe('ask')
    expect(pose('holding')).toBe('holding')
    expect(pose('paused')).toBe('paused')
    expect(pose('chop')).toBe('chop')
    expect(pose('storm')).toBe('storm')
    expect(pose('party')).toBe('landed')
    // Tool errors alone are not weather.
    expect(keyOf(flight(), liveOf({ errorsInRow: 5 })).pose).toBe('air')
    expect(keyOf(flight(), liveOf({ failedRuns: 1 })).pose).toBe('chop')
  })

  test('a stop shows the green flag only when every step in it has receipts', () => {
    const route = flight({ stops: 3, per: 2, at: [2, 0], verified: 1 })
    const key = keyOf(route, liveOf())
    expect(key.pins.map(pin => pin.state)).toEqual(['verified', 'done', 'current'])
    const vouched = flight({ stops: 3, per: 2, at: [2, 0], verified: 1 })
    vouched.steps.forEach(step => {
      if (step.featureId === 'f1') step.doneBy = 'you'
    })
    expect(keyOf(vouched, liveOf()).pins[0]?.state).toBe('done')
  })

  test('the alt text is plain words from the key, at most 200 characters', () => {
    const { route, live } = stateOf('air', 4, 2)
    const alt = sceneAlt(keyOf(route, live))
    expect(alt).toContain('9:15 AM')
    expect(alt).toContain('stop 2 of 4')
    expect(/\p{Extended_Pictographic}/u.test(alt)).toBe(false)
    expect(sceneAlt(keyOf(null, liveOf()))).toContain('captain (Claude)')
  })
})

describe('the picture never jumps, replays, overlaps or overclaims', () => {
  test('a take-off waiting for its Go turn plays through the turn starting', () => {
    const route = flight({ at: [0, 0], verified: 0, takeoffAt: NOW, movedAt: NOW - 60_000 })
    const idle = liveOf({ isRunning: false, turnStartedAt: NOW - 90_000 })
    const pressed = keyOf(route, idle, { now: NOW + 100 })
    expect([pressed.pose, pressed.move]).toEqual(['air', { kind: 'takeoff' }])
    for (const gap of [100, 600, 2000]) {
      const running = liveOf({ turnStartedAt: NOW + gap })
      const now = NOW + gap + 50
      expect(sceneSvg(keyOf(route, running, { now }))).toBe(sceneSvg(keyOf(route, idle, { now })))
    }
    // No Go turn by the end of it: holding, as before.
    expect(keyOf(route, idle, { now: NOW + ONE_SHOT_MS.takeoff }).pose).toBe('holding')
  })

  test('a change with no time of its own (the turn ending) drops a running stamp, never replays it', () => {
    const route = flight({ at: [2, 0], verified: 2, checked: { id: 's2-2', at: NOW } })
    expect(keyOf(route, liveOf(), { now: NOW + 300 }).stamp).toBe(1)
    const ended = keyOf(route, liveOf({ isRunning: false, changedAt: NOW + 800 }), { now: NOW + 900 })
    expect([ended.pose, ended.stamp]).toEqual(['holding', -1])
    expect(sceneSvg(ended)).not.toContain('values="2 2;1 1"')
  })

  test('removing the stop the plane is on never flies it backward', () => {
    for (const target of ['s21', 'f2']) {
      const plan = {
        goal: 'Demo',
        features: ['Setup', 'Login', 'Signup', 'Docs'].map((title, i) => ({ id: `f${i + 1}`, title, why: '', steps: [{ id: `s${i + 1}1`, title: 'Step', why: '', files: [`f${i + 1}.js`], check: '' }] })),
      }
      const route = applySet(null, plan, NOW - 100_000, { departure: 'go', countdownSeconds: 30, isApproved: true }).route
      applyStep(route, { start: 's11' }, NOW - 90_000)
      applyStep(route, { finish: 's11', start: 's21' }, NOW - 80_000)
      userEdit(route, 'remove', target, '', NOW)
      const key = keyOf(route, liveOf(), { now: NOW + 100 })
      expect(route.plane).toBe('s31')
      expect(route.planeFrom).toBe('s21')
      expect(key.move?.kind === 'glide' && key.move.isUturn).toBe(false)
    }
  })

  test('the alt text says "checked", not "by tests", when the person signed steps off', () => {
    const route = flight({ stops: 1, per: 2, isAllChecked: true, landedAt: NOW - 600_000 })
    const yours = route.steps[1]
    if (yours !== undefined) yours.doneBy = 'you'
    const alt = sceneAlt(keyOf(route, liveOf({ isRunning: false })))
    expect(alt).toContain('landed, every step checked.')
    expect(alt).toContain('1 of 1 stop checked.')
    expect(alt).not.toMatch(/test/)
  })

  test('the pause bars sit beside the plane, never on it', () => {
    for (const columns of [30, 63, 100]) {
      for (const isStrip of [false, true]) {
        for (let stops = 1; stops <= 8; stops++) {
          for (let at = 0; at < stops; at++) {
            const key = keyOf(flight({ stops, per: 1, at: [at, 0], isPaused: true }), liveOf({ isRunning: false }), { columns, isStrip })
            const bx = Number(sceneSvg(key).match(/translate\((\d+) \d+\) scale\(2\)/)?.[1])
            expect(bx + 14 <= key.planeX - 13 || bx >= key.planeX + 13).toBe(true)
          }
        }
      }
    }
  })

  test('the clouds cover the sky at every phase: three copies a layer', () => {
    const { route, live } = stateOf('air', 4, 0)
    const key = keyOf(route, live)
    expect(sceneSvg(key).split(`<g transform="translate(${2 * key.W} 0)">`).length - 1).toBe(2)
  })

  test('the dawn fade stays inside the frame', () => {
    for (const isStrip of [false, true]) {
      const key = keyOf(flight({ at: [0, 0], verified: 0, takeoffAt: NOW }), liveOf(), { now: NOW + 100, isStrip })
      const fade = sceneSvg(key).split('<g opacity="0">')[1]?.split('<animate')[0] ?? ''
      const rects = [...fade.matchAll(/<rect x="\d+" y="(\d+)" width="\d+" height="(\d+)"/g)]
      expect(rects.length).toBeGreaterThan(0)
      for (const [, y, h] of rects) {
        expect(Number(y)).toBeGreaterThanOrEqual(2)
        expect(Number(y) + Number(h)).toBeLessThanOrEqual(key.H - 2)
      }
    }
  })

  test("the party's confetti lands exactly where it then rests", () => {
    const { route, live } = stateOf('party', 4, 2, { landedAt: NOW })
    const confetti = (svg: string) => {
      const from = svg.indexOf('<g id="confetti">')
      let depth = 0
      for (const match of svg.slice(from).matchAll(/<(\/?)g\b/g)) {
        depth += match[1] === '/' ? -1 : 1
        if (depth === 0) return svg.slice(from, from + (match.index ?? 0))
      }
      return ''
    }
    const party = confetti(sceneSvg(keyOf(route, live, { now: NOW + 100 })))
    const rest = confetti(sceneSvg(keyOf(route, live, { now: NOW + ONE_SHOT_MS.landingParty })))
    const rects = (part: string) => (part.match(/<rect [^>]*\/>/g) ?? []).sort()
    expect(rects(party)).toHaveLength(24)
    expect(rects(party)).toEqual(rects(rest))
    for (const match of party.matchAll(/<animateTransform [^>]*values="([^"]*)"/g)) expect(match[1]?.endsWith(';0 0')).toBe(true)
  })
})
