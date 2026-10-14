import { describe, expect, test } from 'claude-code/testing'

import {
  applyDecide,
  applyPatch,
  applySet,
  applyStep,
  counts,
  deliverEdits,
  isTestCommand,
  isUnapplied,
  readTestOutput,
  reconcile,
  seeTestRun,
  seeWrite,
  undoEdit,
  userEdit,
} from '../hooks/model'
import type { Route } from '../types'

const GO = { departure: 'countdown' as const, countdownSeconds: 30, isApproved: false }

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
