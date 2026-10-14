import { describe, expect, test } from 'claude-code/testing'

import {
  applyDecide,
  applyPatch,
  applySet,
  applyStep,
  counts,
  deliverEdits,
  hasReceipts,
  isStopVerified,
  isTestCommand,
  isUnapplied,
  landingOf,
  readTestOutput,
  reconcile,
  seeTestRun,
  seeWrite,
  undoEdit,
  userEdit,
} from '../hooks/model'
import type { Landing } from '../hooks/model'
import type { Route, Step, StepStatus } from '../types'

const GO = { departure: 'countdown' as const, countdownSeconds: 30, isApproved: false }
const AUTO = { ...GO, departure: 'auto' as const }
const PASS = { passed: 11, failed: 0, isOk: true }
const FAIL = { passed: 10, failed: 1, isOk: false }

// The to-do task from the test flights: four steps, each declaring its files.
const TODO = {
  op: 'set',
  goal: 'A small to-do list module',
  features: [
    {
      id: 'f1',
      title: 'Keep a to-do list',
      why: 'so tasks are not forgotten',
      steps: [
        { id: 's1', title: 'Add, complete and remove to-dos', why: 'the core', files: ['todo.js'], check: 'node --test' },
        { id: 's2', title: 'Tests cover every action', why: 'proof', files: ['todo.test.js'], check: 'node --test' },
        { id: 's3', title: 'All tests pass', why: 'confidence', files: [], check: 'node --test' },
        { id: 's4', title: 'Short README', why: 'so others can use it', files: ['README.md'], check: 'read it' },
      ],
    },
  ],
}

function filed(options = GO): Route {
  return applySet(null, TODO, 1000, options).route
}

describe('filing the route', () => {
  test('builds waypoints and steps, and waits at the gate for a route of four steps', () => {
    const { route, answer } = applySet(null, TODO, 1000, GO)
    expect(route.steps.map(step => step.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(route.gate).toBe('waiting')
    expect(answer.result.ok).toBe(true)
    expect(answer.context[0]).toContain('end your turn')
  })

  test('takes off at once for three steps or fewer, for an approved plan, and in auto', () => {
    const small = { ...TODO, features: [{ ...TODO.features[0]!, steps: TODO.features[0]!.steps.slice(0, 3) }] }
    expect(applySet(null, small, 1, GO).route.gate).toBe('go')
    expect(applySet(null, TODO, 1, { ...GO, isApproved: true }).route.gate).toBe('go')
    expect(applySet(null, TODO, 1, { ...GO, departure: 'auto' }).route.gate).toBe('go')
  })

  test('re-keys duplicate ids so every step has its own', () => {
    const twice = { ...TODO, features: [{ ...TODO.features[0]!, steps: [TODO.features[0]!.steps[0]!, TODO.features[0]!.steps[0]!] }] }
    const ids = applySet(null, twice, 1, GO).route.steps.map(step => step.id)
    expect(new Set(ids).size).toBe(2)
  })

  test('a re-filed route keeps what happened and every step the person removed', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 2000)
    userEdit(route, 'remove', 's4', '', 2100)
    const again = applySet(route, TODO, 3000, GO).route
    expect(again.steps.find(step => step.id === 's1')?.status).toBe('active')
    expect(again.steps.find(step => step.id === 's4')?.status).toBe('removed')
  })
})

describe('what the map sees', () => {
  test('a write to a later step moves the plane forward and closes the step before it', () => {
    const route = filed()
    expect(seeWrite(route, '/p/todo.js', 10)).toMatchObject({ kind: 'step', stepId: 's1', moved: true })
    expect(route.plane).toBe('s1')
    seeWrite(route, '/p/todo.test.js', 20)
    expect(route.plane).toBe('s2')
    expect(route.steps[0]?.status).toBe('done')
    expect(route.steps[0]?.doneBy).toBe('seen')
  })

  test("Claude's late start of an earlier step does not pull the plane back over seen work", () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    applyStep(route, { op: 'step', start: 's1' }, 30)
    expect(route.plane).toBe('s2')
  })

  test("Claude's start moves the plane when no work was seen in between", () => {
    const route = filed()
    applyStep(route, { op: 'step', start: 's2' }, 30)
    expect(route.plane).toBe('s2')
    expect(route.steps[1]?.status).toBe('active')
  })

  test('a file shared by two steps counts toward both', () => {
    const shared = { ...TODO, features: [{ ...TODO.features[0]!, steps: [
      { id: 'a', title: 'Converter', why: '', files: ['md.js'], check: 'node --test' },
      { id: 'b', title: 'Command line', why: '', files: ['md.js'], check: 'node md.js x.md' },
    ] }] }
    const route = applySet(null, shared, 1, GO).route
    seeWrite(route, '/p/md.js', 10)
    expect(route.steps.every(step => step.written.includes('md.js'))).toBe(true)
  })

  test('a passing test run checks every fully written step and the test step', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    const changed = seeTestRun(route, 'node --test', { passed: 11, failed: 0, isOk: true }, 30)
    expect(changed.sort()).toEqual(['s1', 's2', 's3'])
    expect(route.steps.map(step => step.status)).toEqual(['checked', 'checked', 'checked', 'pending'])
  })

  test('a failing run turns checked steps into "done? last test failed" and leaves work in progress alone', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeTestRun(route, 'node --test', { passed: 3, failed: 0, isOk: true }, 20)
    seeWrite(route, '/p/todo.test.js', 25)
    seeTestRun(route, 'node --test', { passed: 3, failed: 1, isOk: false }, 30)
    expect(route.steps[0]?.status).toBe('failed')
    expect(route.steps[1]?.status).toBe('active')
  })

  test('reads only summary lines: node --test, jest, pytest, mocha', () => {
    expect(readTestOutput('ℹ tests 11\nℹ pass 11\nℹ fail 0', false)).toEqual({ passed: 11, failed: 0, isOk: true })
    expect(readTestOutput('# pass 9\n# fail 2', true)).toEqual({ passed: 9, failed: 2, isOk: false })
    expect(readTestOutput('Test Suites: 1 passed, 1 total\nTests:       1 failed, 14 passed, 15 total', false)).toMatchObject({ passed: 14, failed: 1, isOk: false })
    expect(readTestOutput('==== 3 passed, 1 failed in 0.21s ====', false)).toMatchObject({ passed: 3, failed: 1, isOk: false })
    expect(readTestOutput('  14 passing (20ms)', false)).toMatchObject({ passed: 14, failed: 0, isOk: true })
    expect(readTestOutput(' 37 pass\n 0 fail\nRan 37 tests across 2 files.', false)).toMatchObject({ passed: 37, failed: 0, isOk: true })
  })

  test('a test named after failures does not fail a green run, and no summary is unknown', () => {
    expect(readTestOutput('✔ locks the account after 3 failed attempts\nℹ pass 5\nℹ fail 0', false).isOk).toBe(true)
    expect(readTestOutput('running in background with ID abc', false).isOk).toBe(null)
  })

  test('only a test runner at command position is a test run', () => {
    expect(isTestCommand('node --test')).toBe(true)
    expect(isTestCommand('cd "/my app" && node --test 2>&1 | tail -12')).toBe(true)
    expect(isTestCommand('npm test')).toBe(true)
    expect(isTestCommand('npm install --save-dev jest')).toBe(false)
    expect(isTestCommand('pip install pytest')).toBe(false)
    expect(isTestCommand('git commit -m "add jest tests"')).toBe(false)
    expect(isTestCommand('cat jest.config.js')).toBe(false)
    expect(isTestCommand("python3 - <<'EOF'\nrun('&& node --test')\nEOF")).toBe(false)
    expect(isTestCommand("echo 'cd x && npm test'")).toBe(false)
  })

  test('at the end of a turn a fully written step is done, and an all-closed route lands', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', { passed: 11, failed: 0, isOk: true }, 30)
    seeWrite(route, '/p/README.md', 40)
    const { hasLanded, open } = reconcile(route, 50)
    expect(open).toEqual([])
    expect(hasLanded).toBe(true)
    expect(route.steps[3]?.status).toBe('done')
    expect(route.plane).toBe(null)
  })

  test('a write to a removed step is reported, not counted', () => {
    const route = filed()
    userEdit(route, 'remove', 's4', '', 5)
    expect(seeWrite(route, '/p/README.md', 10)).toEqual({ kind: 'removed', title: 'Short README' })
  })
})

describe('the person changes the map', () => {
  test('a removal lands at once, rides the next delivery, and is acknowledged by acks', () => {
    const route = filed()
    const edit = userEdit(route, 'remove', 's4', '', 5)
    expect(route.steps[3]?.status).toBe('removed')
    expect(edit?.state).toBe('queued')
    const text = deliverEdits(route, 6)
    expect(text).toContain('e1: the user removed step s4 "Short README"')
    expect(route.edits[0]?.state).toBe('delivered')
    applyStep(route, { op: 'step', finish: 's1', acks: ['e1'] }, 6)
    expect(route.edits[0]?.state).toBe('acked')
  })

  test('starting a removed step is refused as data', () => {
    const route = filed()
    userEdit(route, 'remove', 's4', '', 5)
    const answer = applyStep(route, { op: 'step', start: 's4' }, 6)
    expect(answer.result.ok).toBe(false)
    expect(String(answer.result.error)).toContain('removed by the user')
  })

  test('an unacknowledged change is re-sent once after two route calls miss it, then marked', () => {
    const route = filed()
    userEdit(route, 'skip', 's3', '', 5)
    deliverEdits(route, 5)
    applyStep(route, { op: 'step', finish: 's1' }, 6)
    expect(deliverEdits(route, 6)).toBe(undefined)
    applyStep(route, { op: 'step', start: 's2' }, 7)
    expect(deliverEdits(route, 7)).toContain('e1')
    expect(isUnapplied(route.edits[0]!)).toBe(false)
    applyStep(route, { op: 'step', finish: 's2' }, 8)
    expect(isUnapplied(route.edits[0]!)).toBe(true)
    expect(deliverEdits(route, 9)).toBe(undefined)
    expect(deliverEdits(route, 9, true)).toContain('e1')
  })

  test("the person's wording wins over Claude's reword", () => {
    const route = filed()
    userEdit(route, 'rename', 's4', 'A friendly how-to page', 5)
    const answer = applyPatch(route, { op: 'patch', reword: [{ id: 's4', title: 'README.md file' }] }, 6)
    expect(route.steps[3]?.title).toBe('A friendly how-to page')
    expect(answer.context[0]).toContain('their wording stands')
  })

  test('a switched decision stands against Claude re-deciding', () => {
    const route = filed()
    applyDecide(route, { op: 'decide', id: 'd1', question: 'Where to save', choice: 'a JSON file', alternatives: ['SQLite'], why: 'simple', affects: ['s1'] }, 5)
    userEdit(route, 'switch', 'd1', 'SQLite', 6)
    const answer = applyDecide(route, { op: 'decide', id: 'd1', question: 'Where to save', choice: 'a JSON file', alternatives: [], why: '', affects: [] }, 7)
    expect(answer.result.ok).toBe(false)
    expect(route.decisions[0]?.userChoice).toBe('SQLite')
  })

  test('undo restores the step while the change is still queued', () => {
    const route = filed()
    const edit = userEdit(route, 'remove', 's2', '', 5)
    expect(undoEdit(route, edit?.id ?? '')).toBe(true)
    expect(route.steps[1]?.status).toBe('pending')
    expect(route.edits).toEqual([])
  })

  test('a proposed waypoint becomes real when Claude plans it', () => {
    const route = filed()
    userEdit(route, 'add-feature', 'route', 'Reset passwords', 5)
    deliverEdits(route, 5)
    applyPatch(route, { op: 'patch', add: [{ id: 's9', feature: 'x', featureTitle: 'Reset passwords', title: 'Send a reset link', files: ['reset.js'], check: 'node --test' }] }, 6)
    expect(route.features.find(feature => feature.title === 'Reset passwords')?.proposedBy).toBe(undefined)
    expect(route.edits[0]?.state).toBe('acked')
    expect(counts(route).total).toBe(5)
  })
})

describe('fixes from the code review', () => {
  test('a renumbered re-file does not turn Claude\'s new step into the removed one', () => {
    const route = filed()
    userEdit(route, 'remove', 's4', '', 5)
    const renumbered = {
      ...TODO,
      features: [{ ...TODO.features[0]!, steps: [...TODO.features[0]!.steps.slice(0, 3), { id: 's4', title: 'Add priorities', why: 'order', files: ['priorities.js'], check: 'node --test' }] }],
    }
    const again = applySet(route, renumbered, 6, GO).route
    expect(again.steps[3]?.title).toBe('Add priorities')
    expect(again.steps[3]?.status).toBe('pending')
  })

  test('re-filing while held keeps the hold', () => {
    const route = filed()
    route.gate = 'held'
    const { route: again, answer } = applySet(route, TODO, 6, GO)
    expect(again.gate).toBe('held')
    expect(answer.context[0]).toContain('Take off')
  })

  test('set acknowledges the edits it names', () => {
    const route = filed()
    userEdit(route, 'remove', 's4', '', 5)
    deliverEdits(route, 5)
    applySet(route, { ...TODO, acks: ['e1'] }, 6, GO)
    expect(route.edits[0]?.state).toBe('acked')
  })

  test('a passing run does not check a step whose own check is not a test', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeWrite(route, '/p/README.md', 30)
    seeTestRun(route, 'node --test', { passed: 11, failed: 0, isOk: true }, 40)
    expect(route.steps[3]?.status).toBe('active')
    expect(route.steps[0]?.status).toBe('checked')
  })

  test('an unknown run (no summary) changes nothing', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    expect(seeTestRun(route, 'node --test', { passed: 0, failed: 0, isOk: null }, 20)).toEqual([])
    expect(route.steps[0]?.status).toBe('active')
  })

  test("the person's skip survives Claude's next write", () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    userEdit(route, 'skip', 's1', '', 11)
    expect(route.plane).not.toBe('s1')
    expect(seeWrite(route, '/p/todo.js', 12)).toEqual({ kind: 'skipped', title: 'Add, complete and remove to-dos' })
    expect(route.steps[0]?.status).toBe('skipped')
  })

  test('a redo reopens a landed flight', () => {
    const route = filed()
    for (const step of route.steps) step.status = 'checked'
    reconcile(route, 50)
    expect(route.landedAt).toBeGreaterThan(0)
    userEdit(route, 'redo', 's2', '', 60)
    expect(route.landedAt).toBe(0)
    expect(reconcile(route, 70).hasLanded).toBe(false)
  })

  test('a blocked step keeps the flight from landing', () => {
    const route = filed()
    for (const step of route.steps) step.status = 'checked'
    route.steps[2]!.status = 'blocked'
    expect(reconcile(route, 50)).toMatchObject({ hasLanded: false, blocked: 1 })
  })

  test('"I checked it" marks the step checked by you, and undo restores it', () => {
    const route = filed()
    route.steps[3]!.status = 'done'
    const edit = userEdit(route, 'checked', 's4', '', 5)
    expect(route.steps[3]).toMatchObject({ status: 'checked', doneBy: 'you' })
    undoEdit(route, edit?.id ?? '')
    expect(route.steps[3]?.status).toBe('done')
  })

  test('a pause ends with the turn', () => {
    const route = filed()
    userEdit(route, 'pause', 'route', '', 5)
    deliverEdits(route, 5)
    reconcile(route, 10)
    expect(route.edits[0]?.state).toBe('acked')
  })

  test('a declared path with a directory matches only that path', () => {
    const route = applySet(null, { ...TODO, features: [{ ...TODO.features[0]!, steps: [
      { id: 'a', title: 'Admin page', why: '', files: ['src/admin/index.ts'], check: 'node --test' },
      { id: 'b', title: 'Server', why: '', files: ['src/server/index.ts'], check: 'node --test' },
      { id: 'c', title: 'Docs', why: '', files: ['README.md'], check: 'read it' },
      { id: 'd', title: 'More docs', why: '', files: ['docs/x.md'], check: 'read it' },
    ] }] }, 1, GO).route
    seeWrite(route, '/repo/src/server/index.ts', 10)
    expect(route.steps[0]?.written).toEqual([])
    expect(route.steps[1]?.written).toEqual(['src/server/index.ts'])
  })

  test("Claude's drop is not treated as the person's removal", () => {
    const route = filed()
    applyPatch(route, { op: 'patch', drop: ['s4'] }, 5)
    expect(route.steps[3]).toMatchObject({ status: 'removed', removedBy: 'claude' })
    const again = applySet(route, TODO, 6, GO).route
    expect(again.steps[3]?.status).toBe('removed')
    const fresh = applySet(route, { ...TODO, features: [{ ...TODO.features[0]!, steps: TODO.features[0]!.steps.map(step => (step.id === 's4' ? { ...step, id: 's9' } : step)) }] }, 7, GO).route
    expect(fresh.steps[3]?.status).toBe('pending')
  })
})

// ---------------------------------------------------------------- v2: honesty and event times

// Two stops: sign-in code with tests, and a how-to page checked by eye.
const TRIP = {
  op: 'set',
  goal: 'Sign in',
  features: [
    {
      id: 'f1',
      title: 'Sign in works',
      why: '',
      steps: [
        { id: 'a', title: 'Check the password', why: '', files: ['auth.js'], check: 'node --test' },
        { id: 'b', title: 'Tests for sign in', why: '', files: ['auth.test.js'], check: 'node --test' },
      ],
    },
    { id: 'f2', title: 'Tell people', why: '', steps: [{ id: 'c', title: 'A how-to page', why: '', files: ['HOWTO.md'], check: 'read it' }] },
  ],
}

type Closed = [StepStatus, Step['doneBy']]

function mark(route: Route, id: string, [status, doneBy]: Closed) {
  const step = route.steps.find(one => one.id === id)
  if (step === undefined) throw new Error(`no step ${id}`)
  step.status = status
  if (doneBy === undefined) delete step.doneBy
  else step.doneBy = doneBy
}

// The to-do route with each step closed as given, after a run with `failed` failures.
function closedAs(rows: Closed[], failed = 0): Route {
  const route = filed()
  rows.forEach((row, index) => mark(route, `s${index + 1}`, row))
  route.tests = { passed: 11, failed, at: 30, command: 'node --test' }

  return route
}

const SEEN: Closed = ['checked', 'seen']
const CLAUDE_SEEN: Closed = ['checked', 'claude']
const YOURS: Closed = ['checked', 'you']
const YOU_SKIPPED: Closed = ['skipped', 'you']

const LANDINGS: [string, Closed[], number, Landing][] = [
  ['every step checked with receipts', [SEEN, SEEN, CLAUDE_SEEN, SEEN], 0, 'party'],
  ['receipts, and a step the person skipped', [SEEN, SEEN, SEEN, YOU_SKIPPED], 0, 'party'],
  ['receipts, and a step the person removed', [SEEN, SEEN, SEEN, ['removed', undefined]], 0, 'party'],
  ['receipts, and one step only "I checked it" (R6: told as "1 by you")', [SEEN, SEEN, SEEN, YOURS], 0, 'party'],
  ['every step only "I checked it"', [YOURS, YOURS, YOURS, YOURS], 0, 'quiet'],
  ['some steps only "I checked it", the rest skipped by the person', [YOURS, YOURS, YOU_SKIPPED, YOU_SKIPPED], 0, 'quiet'],
  ['a step done, not tested', [SEEN, SEEN, SEEN, ['done', 'claude']], 0, 'quiet'],
  ['a step the map saw written but no test checked', [SEEN, SEEN, SEEN, ['done', 'seen']], 0, 'quiet'],
  ['a step Claude skipped', [SEEN, SEEN, SEEN, ['skipped', 'claude']], 0, 'quiet'],
  ['a skipped step with no word on who skipped it', [SEEN, SEEN, SEEN, ['skipped', undefined]], 0, 'quiet'],
  ['a step still open', [SEEN, SEEN, SEEN, ['active', undefined]], 0, 'quiet'],
  ['a blocked step', [SEEN, SEEN, SEEN, ['blocked', undefined]], 0, 'quiet'],
  ['no live steps', [['removed', undefined], ['removed', undefined], ['removed', undefined], ['removed', undefined]], 0, 'quiet'],
  ['every step checked, but the last run failed', [SEEN, SEEN, SEEN, SEEN], 1, 'amber'],
  ['a failing step', [SEEN, SEEN, SEEN, ['failed', 'seen']], 0, 'amber'],
  ['a failing step and a step Claude skipped', [['failed', 'seen'], SEEN, SEEN, ['skipped', 'claude']], 0, 'amber'],
]

describe('how a landing is told (R6)', () => {
  for (const [name, rows, failed, landing] of LANDINGS) {
    test(`${landing}: ${name}`, () => {
      expect(landingOf(closedAs(rows, failed))).toBe(landing)
    })
  }

  test('a flight the map saw pass, with the README skipped by the person, lands as a party', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    userEdit(route, 'skip', 's4', '', 40)
    expect(reconcile(route, 50).hasLanded).toBe(true)
    expect(landingOf(route)).toBe('party')
  })

  test('a README only written lands quiet', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    seeWrite(route, '/p/README.md', 40)
    expect(reconcile(route, 50).hasLanded).toBe(true)
    expect(landingOf(route)).toBe('quiet')
  })

  test("Claude's skip of a step the person had checked is Claude's, and keeps the landing quiet", () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    seeWrite(route, '/p/README.md', 40)
    userEdit(route, 'checked', 's4', '', 45)
    applyStep(route, { op: 'step', finish: 's4', outcome: 'skipped' }, 50)
    expect(route.steps[3]).toMatchObject({ status: 'skipped', doneBy: 'claude' })
    expect(reconcile(route, 60).hasLanded).toBe(true)
    expect(landingOf(route)).toBe('quiet')
  })
})

describe('a stop is verified (green flag, chime)', () => {
  test('when every step in it has receipts, and only that stop', () => {
    const route = applySet(null, TRIP, 1, GO).route
    expect(isStopVerified(route, 'f1')).toBe(false)
    seeWrite(route, '/p/auth.js', 10)
    seeTestRun(route, 'node --test', PASS, 15)
    expect(route.steps[0]).toMatchObject({ status: 'checked', checkedAt: 15 })
    expect(isStopVerified(route, 'f1')).toBe(false)
    seeWrite(route, '/p/auth.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    expect(isStopVerified(route, 'f1')).toBe(true)
    expect(isStopVerified(route, 'f2')).toBe(false)
    seeWrite(route, '/p/HOWTO.md', 40)
    reconcile(route, 50)
    expect(isStopVerified(route, 'f2')).toBe(false)
    userEdit(route, 'checked', 'c', '', 60)
    expect(isStopVerified(route, 'f2')).toBe(false)
    expect(isStopVerified(route, 'nope')).toBe(false)
  })

  test("the person's skip does not hold it back; Claude's skip, a failing step or no receipts do", () => {
    const route = applySet(null, TRIP, 1, GO).route
    mark(route, 'a', SEEN)
    mark(route, 'b', YOU_SKIPPED)
    expect(isStopVerified(route, 'f1')).toBe(true)
    mark(route, 'b', YOURS)
    expect(isStopVerified(route, 'f1')).toBe(true)
    mark(route, 'b', ['skipped', 'claude'])
    expect(isStopVerified(route, 'f1')).toBe(false)
    mark(route, 'b', SEEN)
    mark(route, 'a', ['failed', 'seen'])
    expect(isStopVerified(route, 'f1')).toBe(false)
    mark(route, 'a', YOURS)
    mark(route, 'b', YOURS)
    expect(isStopVerified(route, 'f1')).toBe(false)
  })

  test('a stop with every step removed is not verified', () => {
    const route = applySet(null, TRIP, 1, GO).route
    userEdit(route, 'remove', 'f1', '', 5)
    expect(isStopVerified(route, 'f1')).toBe(false)
  })
})

describe('receipts are stamped (checkedAt)', () => {
  test('on each step a pass the map saw checks, once', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    expect(route.steps.map(step => step.checkedAt)).toEqual([30, 30, 30, undefined])
    seeTestRun(route, 'node --test', PASS, 40)
    expect(route.steps[0]?.checkedAt).toBe(30)
  })

  test('a later failing run takes the stamp away, and the next pass stamps it again', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    seeTestRun(route, 'node --test', FAIL, 40)
    expect(route.steps[0]?.status).toBe('failed')
    expect(route.steps.map(step => step.checkedAt)).toEqual([undefined, undefined, undefined, undefined])
    expect(landingOf(route)).toBe('amber')
    seeTestRun(route, 'node --test', PASS, 50)
    expect(route.steps[0]).toMatchObject({ status: 'checked', doneBy: 'seen', checkedAt: 50 })
  })

  test('"I checked it" never stamps, and never takes receipts away', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    seeWrite(route, '/p/README.md', 40)
    userEdit(route, 'checked', 's4', '', 45)
    expect(route.steps[3]).toMatchObject({ status: 'checked', doneBy: 'you' })
    expect(route.steps[3]?.checkedAt).toBeUndefined()
    expect(hasReceipts(route.steps[3]!)).toBe(false)
    userEdit(route, 'checked', 's1', '', 50)
    expect(route.steps[0]).toMatchObject({ status: 'checked', doneBy: 'seen', checkedAt: 30 })
  })

  test("Claude's finish stamps it only when it names a pass the map saw", () => {
    const route = filed()
    applyStep(route, { op: 'step', finish: ['s1', 's4'], evidence: 'node --test: 11 passed' }, 10)
    expect(route.steps[0]).toMatchObject({ status: 'done', doneBy: 'claude' })
    expect(route.steps[0]?.checkedAt).toBeUndefined()
    seeTestRun(route, 'node --test', PASS, 20)
    applyStep(route, { op: 'step', finish: ['s1', 's2', 's4'], evidence: 'node --test: 11 passed' }, 30)
    expect(route.steps.map(step => [step.status, step.checkedAt])).toEqual([
      ['checked', 30],
      ['checked', 30],
      ['pending', undefined],
      ['done', undefined],
    ])
    applyStep(route, { op: 'step', finish: 's3', evidence: 'it works' }, 40)
    expect(route.steps[2]).toMatchObject({ status: 'done', doneBy: 'claude' })
    expect(route.steps[2]?.checkedAt).toBeUndefined()
  })

  test("Claude's word does not turn the person's check into receipts; a pass the map saw does", () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    userEdit(route, 'checked', 's1', '', 15)
    applyStep(route, { op: 'step', finish: 's1', evidence: 'none' }, 20)
    expect(route.steps[0]).toMatchObject({ status: 'checked', doneBy: 'you' })
    expect(hasReceipts(route.steps[0]!)).toBe(false)
    seeTestRun(route, 'node --test', PASS, 30)
    expect(route.steps[0]).toMatchObject({ status: 'checked', doneBy: 'seen', checkedAt: 30 })
    userEdit(route, 'checked', 's2', '', 35)
    applyStep(route, { op: 'step', finish: 's2', evidence: 'node --test: 11 passed' }, 40)
    expect(route.steps[1]).toMatchObject({ status: 'checked', doneBy: 'claude', checkedAt: 40 })
  })

  test('a redo, a fresh write or a restart takes the stamp away; undo of the redo brings it back', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    seeTestRun(route, 'node --test', PASS, 30)
    const redo = userEdit(route, 'redo', 's1', '', 40)
    expect(route.steps[0]?.status).toBe('pending')
    expect(route.steps[0]?.checkedAt).toBeUndefined()
    undoEdit(route, redo?.id ?? '')
    expect(route.steps[0]).toMatchObject({ status: 'checked', checkedAt: 30 })
    seeWrite(route, '/p/todo.test.js', 50)
    expect(route.steps[1]?.status).toBe('active')
    expect(route.steps[1]?.checkedAt).toBeUndefined()
    applyStep(route, { op: 'step', start: 's3' }, 60)
    expect(route.steps[2]?.status).toBe('active')
    expect(route.steps[2]?.checkedAt).toBeUndefined()
  })
})

describe('the plane remembers where it came from (planeFrom)', () => {
  test('every forward move records the step it left', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    expect(route).toMatchObject({ plane: 's1', planeFrom: null, movedAt: 10 })
    seeWrite(route, '/p/todo.test.js', 20)
    expect(route).toMatchObject({ plane: 's2', planeFrom: 's1', movedAt: 20 })
    applyStep(route, { op: 'step', start: 's3' }, 30)
    expect(route).toMatchObject({ plane: 's3', planeFrom: 's2', movedAt: 30 })
  })

  test('no move, no change: another write on the same step, or a pull back that is refused', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.js', 15)
    expect(route).toMatchObject({ plane: 's1', planeFrom: null, movedAt: 10 })
    seeWrite(route, '/p/todo.test.js', 20)
    applyStep(route, { op: 'step', start: 's1' }, 30)
    expect(route).toMatchObject({ plane: 's2', planeFrom: 's1', movedAt: 20 })
  })

  test('a redo turns the plane back and records the step it left (the U-turn)', () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    seeWrite(route, '/p/todo.test.js', 20)
    userEdit(route, 'redo', 's1', 'handle empty titles', 25)
    applyStep(route, { op: 'step', start: 's1' }, 30)
    expect(route).toMatchObject({ plane: 's1', planeFrom: 's2', movedAt: 30 })
  })

  test("the person's skip moves the plane on, and the landing takes it off its last step", () => {
    const route = filed()
    seeWrite(route, '/p/todo.js', 10)
    userEdit(route, 'skip', 's1', '', 11)
    expect(route).toMatchObject({ plane: 's2', planeFrom: 's1', movedAt: 11 })

    const flight = filed()
    seeWrite(flight, '/p/todo.js', 10)
    seeWrite(flight, '/p/todo.test.js', 20)
    seeTestRun(flight, 'node --test', PASS, 30)
    seeWrite(flight, '/p/README.md', 40)
    expect(flight).toMatchObject({ plane: 's4', planeFrom: 's2', movedAt: 40 })
    reconcile(flight, 50)
    expect(flight).toMatchObject({ plane: null, planeFrom: 's4', movedAt: 50, landedAt: 50 })
  })

  test('after a landing, a redo or new work flies the plane back from its last step', () => {
    const landed = () => {
      const flight = filed()
      for (const path of ['/p/todo.js', '/p/todo.test.js', '/p/README.md']) seeWrite(flight, path, 10)
      seeTestRun(flight, 'node --test', PASS, 20)
      reconcile(flight, 50)
      return flight
    }
    const redo = landed()
    userEdit(redo, 'redo', 's2', '', 60)
    expect(redo).toMatchObject({ plane: 's2', planeFrom: 's4', movedAt: 60, landedAt: 0 })
    applyStep(redo, { op: 'step', start: 's2' }, 70)
    expect(redo).toMatchObject({ plane: 's2', planeFrom: 's4', movedAt: 60 })

    const more = landed()
    applyPatch(more, { op: 'patch', add: [{ id: 's5', feature: 'f1', title: 'More', files: ['more.js'], check: 'node --test' }] }, 60)
    expect(more).toMatchObject({ plane: 's5', planeFrom: 's4', movedAt: 60 })
  })

  test("removing the plane's whole stop records the step it was on, not one it hopped through", () => {
    const route = applySet(null, TRIP, 1000, GO).route
    applyStep(route, { op: 'step', start: 'a' }, 2000)
    userEdit(route, 'remove', 'f1', '', 3000)
    expect(route).toMatchObject({ plane: 'c', planeFrom: 'a', movedAt: 3000 })
  })
})

describe('titles hold no control characters', () => {
  test("Claude's and the person's words lose them (the engine refuses a drawing that has one), and keep tabs and newlines", () => {
    const pasted = 'Fix \u001b[31mred\u001b[0m output\u007f\u0085'
    const route = applySet(null, { goal: pasted, features: [{ id: 'f1', title: pasted, steps: [{ id: 's1', title: pasted, files: ['a\u001b.js'], check: 'node --test' }] }] }, 1000, GO).route
    expect(route.goal).toBe('Fix [31mred[0m output')
    expect(route.features[0]?.title).toBe('Fix [31mred[0m output')
    expect(route.steps[0]?.title).toBe('Fix [31mred[0m output')
    expect(route.steps[0]?.files).toEqual(['a.js'])
    applyDecide(route, { op: 'decide', question: 'Which?', choice: 'a', alternatives: ['b\u0007'] }, 1100)
    expect(route.decisions[0]?.alternatives).toEqual(['b'])
    userEdit(route, 'rename', 's1', 'Tidy\u001b\tup', 1200)
    expect(route.steps[0]?.title).toBe('Tidy\tup')
    userEdit(route, 'add-feature', 'route', '\u009bNew stop', 1300)
    expect(route.features.at(-1)?.title).toBe('New stop')
  })
})

describe('the take-off moment (takeoffAt)', () => {
  test('a gate that opens at once records it; one that waits does not', () => {
    expect(applySet(null, TODO, 1000, AUTO).route.takeoffAt).toBe(1000)
    expect(applySet(null, TODO, 1000, { ...GO, isApproved: true }).route.takeoffAt).toBe(1000)
    expect(applySet(null, TRIP, 1000, GO).route.takeoffAt).toBe(1000)
    expect(applySet(null, TODO, 1000, GO).route.takeoffAt).toBeUndefined()
    expect(applySet(filed(), TODO, 2000, AUTO).route.takeoffAt).toBeUndefined()
  })

  test('re-filing a flying route keeps its take-off; a new flight after a landing takes off again', () => {
    const route = applySet(null, TODO, 1000, AUTO).route
    const again = applySet(route, TODO, 2000, AUTO).route
    expect(again.takeoffAt).toBe(1000)
    for (const step of again.steps) step.status = 'checked'
    reconcile(again, 3000)
    expect(applySet(again, TODO, 4000, AUTO).route.takeoffAt).toBe(4000)
  })
})

// A route saved by v1: none of v2's optional fields (planeFrom, takeoffAt, checkedAt).
function savedByV1(): Route {
  return JSON.parse(
    JSON.stringify({
      version: 4,
      goal: 'A small to-do list module',
      features: [{ id: 'f1', title: 'Keep a to-do list', why: '' }],
      steps: [
        { id: 's1', featureId: 'f1', title: 'Add to-dos', why: '', files: ['todo.js'], check: 'node --test', status: 'checked', doneBy: 'seen', written: ['todo.js'] },
        { id: 's2', featureId: 'f1', title: 'Tests', why: '', files: ['todo.test.js'], check: 'node --test', status: 'active', written: [] },
        { id: 's3', featureId: 'f1', title: 'README', why: '', files: ['README.md'], check: 'read it', status: 'pending', written: [] },
      ],
      decisions: [],
      edits: [],
      plane: 's2',
      doing: 'writing tests',
      movedAt: 500,
      setAt: 100,
      lastClaudeAt: 500,
      gate: 'go',
      isPaused: false,
      landedAt: 0,
      addedAt: 0,
      addedCount: 0,
      nextEdit: 1,
      tests: { passed: 4, failed: 0, at: 450, command: 'node --test' },
      files: ['todo.js'],
    }),
  ) as Route
}

describe('a route saved by v1', () => {
  test('counts, tells its landing and verifies its stop without the new fields', () => {
    const route = savedByV1()
    expect(counts(route)).toEqual({ total: 3, done: 1, checked: 1, blocked: 0, left: 2, position: 2 })
    expect(landingOf(route)).toBe('quiet')
    expect(isStopVerified(route, 'f1')).toBe(false)
    expect(hasReceipts(route.steps[0]!)).toBe(true)
    expect(route).not.toHaveProperty('planeFrom')
    expect(route).not.toHaveProperty('takeoffAt')
  })

  test('moves the plane, stamps only new receipts, and lands', () => {
    const route = savedByV1()
    expect(seeWrite(route, '/p/README.md', 600)).toMatchObject({ kind: 'step', stepId: 's3', moved: true })
    expect(route).toMatchObject({ plane: 's3', planeFrom: 's2', movedAt: 600 })
    seeWrite(route, '/p/todo.test.js', 610)
    expect(route).toMatchObject({ plane: 's3', planeFrom: 's2', movedAt: 600 })
    seeTestRun(route, 'node --test', PASS, 620)
    expect(route.steps.map(step => step.checkedAt)).toEqual([undefined, 620, undefined])
    expect(reconcile(route, 630).hasLanded).toBe(true)
    expect(route).toMatchObject({ plane: null, planeFrom: 's3', landedAt: 630 })
    expect(landingOf(route)).toBe('quiet')
    expect(route).not.toHaveProperty('takeoffAt')
  })
})
