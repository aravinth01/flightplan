import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import { ONE_SHOT_MS } from '../hooks/scene'

const TOOL = 'mcp__flightplan__route'

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Flight Plan',
  isFocused: false,
  bodyColumns: 58,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

const PANE = { plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS } as const

const ROUTE = {
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

// What the plugin hands Claude, word for word as v1 did: the voice never
// reaches these (R12).
const GO_TEXT = 'Go: take off and start the route with "Add, complete and remove to-dos".'
const REMOVED_CONTEXT =
  'Flight Plan: the user changed the map. Finish what you are doing in the current step, then apply these before starting the next step, and echo their ids in acks on your next route call:\ne1: the user removed step s4 "Short README": do not implement it'

// What the engine did meanwhile: prompts sent (and the context riding them),
// sounds played, toasts shown, and when the map asked to be drawn again.
type World = { sent: string[]; heard: string[]; sounds: string[]; toasts: string[]; redraws: number[]; clock: MockClock }

// What sits beneath the plugin in a session: the engine's own answers.
function engine(on: On): World {
  const world: World = { sent: [], heard: [], sounds: [], toasts: [], redraws: [], clock: mock.clock(on) }
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.invalidate', () => {
    world.redraws.push(world.clock.now())

    return { value: undefined }
  })
  on('audio.play', ($, e) => {
    world.sounds.push(e.clip.asset ?? '')

    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['desktop'] as const }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 12 }, rateLimits: [], cost: { usd: 0.42 } } }))
  on('prompt.submit', ($, e) => {
    world.sent.push(e.text)
    world.heard.push(...(e.context ?? []))

    return { text: e.text, context: e.context }
  })
  on('tool.call', { tool: 'Write' }, ($, e) => ({ result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [] } }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ℹ tests 11\nℹ pass 11\nℹ fail 0', stderr: '', interrupted: false }, text: 'ℹ tests 11\nℹ pass 11\nℹ fail 0' }))

  return world
}

const write = ($: Engine, path: string) => $.tool.call({ tool: 'Write', file_path: path, content: 'x' })

const runTests = ($: Engine) => $.tool.call({ tool: 'Bash', command: 'node --test', description: 'Run the tests' })

// The plain voice keeps v1's words (ON THE GROUND, READY FOR TAKEOFF, NOW, LANDED).
const PLAIN = { options: { voice: 'plain' } } as const
const FUN = { options: { voice: 'fun' } } as const

describe('a whole flight through the hooks', () => {
  test('route, takeoff, evidence, an edit that rides the next tool result, landing', PLAIN, async ($, on) => {
    const { sent } = engine(on)
    const ui = await $.ui.mount(PANE)
    expect(await ui.find({ text: /ON THE GROUND/ })).toBeDefined()

    // Claude files the route: four steps, so the countdown gate holds it.
    const filed = await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    expect(typeof filed.result).toBe('string')
    expect(String(filed.result)).toContain('"gate":"waiting"')
    expect(await ui.find({ text: /READY FOR TAKEOFF/ })).toBeDefined()

    // The person removes the README step before takeoff, then takes off.
    await ui.press({ key: 'sb-s4' })
    await ui.press({ key: 'ed-remove-s4' })
    expect(await ui.find({ text: /queued/ })).toBeDefined()
    await ui.press({ key: 'takeoff' })
    expect(sent.some(text => text.startsWith('Go: take off'))).toBe(true)

    // Claude works: the plane follows its writes; the change rides the first result.
    await $.turn.start({ text: 'Go: take off', turnId: 't1' })
    const first = await write($, '/p/todo.js')
    expect((first.context ?? []).join('\n')).toContain('removed step s4 "Short README"')
    await write($, '/p/todo.test.js')
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('"type":"Svg"')

    // Writing the removed step's file is refused once, with the reason.
    const refused = await write($, '/p/README.md')
    expect(refused.deny).toContain('removed')

    // The checks pass: everything written is checked; Claude acknowledges the edit.
    await runTests($)
    const reported = await $.tool.call({ tool: TOOL, op: 'step', finish: ['s1', 's2', 's3'], outcome: 'done', evidence: 'node --test: 11 passed', acks: ['e1'] })
    expect(String(reported.result)).toContain('"ok":true')

    // The turn ends: every live step closed, so the flight lands.
    await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
    expect(await ui.find({ text: /LANDED/ })).toBeDefined()
    await ui.unmount()
  })

  test('the map draws on the terminal too, with a glyph for the plane', PLAIN, async ($, on) => {
    engine(on)
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await write($, '/p/todo.js')
    let isFirst = true
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.drawn()).toMatchObject({ type: 'Box' })
      expect(await ui.find({ text: /NOW/ })).toBeDefined()
      // details is one toggle shared by every surface: press it once.
      if (isFirst) await ui.press({ key: 'details' })
      isFirst = false
      expect(await ui.find({ text: /working in: todo.js/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a narrow inline pane draws the compact card', PLAIN, async ($, on) => {
    engine(on)
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await write($, '/p/todo.js')
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE_PROPS, bodyColumns: 40, placement: 'inline' } })
    expect(await ui.find({ text: /next: Tests cover every action/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('a fun-voice flight tells only what the map saw', () => {
  test('receipts on a seen pass, then a quiet landing: no party, no fanfare', FUN, async ($, on) => {
    const world = engine(on)
    const ui = await $.ui.mount(PANE)
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await ui.press({ key: 'takeoff' })
    expect(world.sent).toEqual([GO_TEXT])
    await $.turn.start({ text: GO_TEXT, turnId: 't1' })
    await write($, '/p/todo.js')
    await write($, '/p/todo.test.js')
    expect(await ui.find({ text: /IN THE AIR/ })).toBeDefined()

    // Let the take-off and the glides play out, then the checks pass: the
    // steps they covered get receipts, with a tick, and the stamp lives in
    // the sky for its window only (one redraw just after it ends).
    await world.clock.advance(10_000)
    const ranAt = world.clock.now()
    await runTests($)
    expect(await ui.find({ text: /receipts ✅/ })).toBeDefined()
    expect(world.sounds).toEqual(['fx/tick.wav'])
    await world.clock.advance(ONE_SHOT_MS.stamp + 49)
    expect(world.redraws.filter(at => at > ranAt)).toEqual([])
    await world.clock.advance(1)
    expect(world.redraws.filter(at => at > ranAt)).toEqual([ranAt + ONE_SHOT_MS.stamp + 50])

    // The README is closed on Claude's word alone: no test checks it.
    await write($, '/p/README.md')
    await $.tool.call({ tool: TOOL, op: 'step', finish: ['s1', 's2', 's3', 's4'], outcome: 'done', evidence: 'node --test: 11 passed' })
    await world.clock.advance(10_000)
    await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })

    // A quiet landing: LANDED, a chime, and the toast names what is untested.
    expect(JSON.stringify(await ui.find({ key: 'card-landed' }))).toContain('LANDED')
    expect(/TOUCHDOWN|we ate/.test(JSON.stringify(await ui.drawn()))).toBe(false)
    expect(world.sounds).toEqual(['fx/tick.wav', 'fx/chime.wav'])
    expect(world.toasts.at(-1)).toBe("Landed. No receipts yet on 1 step.")
    expect(world.toasts.some(text => /we ate|touchdown/i.test(text))).toBe(false)
    await ui.unmount()
  })

  test('a helper sent off in the background is on it until it reports back', PLAIN, async ($, on) => {
    engine(on)
    on('tool.call', { tool: 'Agent' }, ($, e) => ({
      result: { status: 'async_launched' as const, agentId: 'a1', description: e.description, prompt: e.prompt, outputFile: '/tmp/a1.out' },
    }))
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await write($, '/p/todo.js')
    await $.tool.call({ tool: 'Agent', description: 'look at the old list code', prompt: 'look' })
    const ui = await $.ui.mount(PANE)
    expect(await ui.find({ text: /helper · working · look at the old list code/ })).toBeDefined()

    // Its own run ends: it is back (coming back is never a check).
    await $.turn.complete({ answer: 'Found it.', durationMs: 1000, isAborted: false, turnId: 't-a1', reason: 'answer', agentId: 'a1' })
    expect(await ui.find({ text: /helper · finished · look at the old list code/ })).toBeDefined()
    await ui.unmount()
  })
})

// ---------------------------------------------------------------- what Claude reads

// Everything Claude reads in a short flight, in order: each tool result with
// its context, the prompts sent for the person and the context riding them.
async function whatClaudeReads($: Engine, world: World): Promise<{ all: string[]; firstWrite: readonly string[] }> {
  const told: string[] = []
  const hear = (ran: { result?: unknown; context?: readonly string[]; deny?: string }) => told.push(JSON.stringify([ran.result ?? null, ran.context ?? [], ran.deny ?? null]))
  hear(await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE }))
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'sb-s4' })
  await ui.press({ key: 'ed-remove-s4' })
  await ui.press({ key: 'takeoff' })
  await $.turn.start({ text: GO_TEXT, turnId: 't1' })
  const first = await write($, '/p/todo.js')
  hear(first)
  hear(await write($, '/p/todo.test.js'))
  hear(await write($, '/p/README.md'))
  hear(await runTests($))
  hear(await $.tool.call({ tool: TOOL, op: 'step', finish: ['s1', 's2', 's3'], outcome: 'done', evidence: 'node --test: 11 passed', acks: ['e1'] }))
  await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  // A message the person types afterwards carries the map's note.
  told.push(JSON.stringify(await $.prompt.submit({ text: 'Thanks!', wait: false, origin: { kind: 'composer' } })))
  await ui.unmount()

  return { all: [...world.sent, ...world.heard, ...told], firstWrite: first.context ?? [] }
}

const READS: { fun?: string[]; plain?: string[] } = {}

describe('the voice never touches what Claude reads', () => {
  for (const voice of ['fun', 'plain'] as const) {
    test(`the Go prompt and the delivered edit, in the ${voice} voice`, { options: { voice } }, async ($, on) => {
      const world = engine(on)
      const reads = await whatClaudeReads($, world)
      expect(world.sent).toEqual([GO_TEXT, 'Thanks!'])
      expect(reads.firstWrite).toEqual([REMOVED_CONTEXT])
      READS[voice] = reads.all
    })
  }

  test('both voices told Claude exactly the same words', () => {
    expect(READS.fun?.length ?? 0).toBeGreaterThan(5)
    expect(READS.fun).toEqual(READS.plain)
  })
})

// ---------------------------------------------------------------- the sky through the hooks

// The sky's picture as drawn: its source and alt, or undefined.
async function skyOf(ui: { drawn: () => Promise<unknown> }): Promise<{ source: string; alt: string } | undefined> {
  const found: { source: string; alt: string }[] = []
  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    const one = node as { type?: string; props?: Record<string, unknown>; children?: unknown }
    if (one.type === 'Svg') found.push({ source: String(one.props?.source), alt: String(one.props?.alt) })
    walk(one.children)
    walk(one.props?.children)
  }
  walk(await ui.drawn())

  return found[0]
}

const SMALL = { ...ROUTE, features: [{ ...ROUTE.features[0]!, steps: ROUTE.features[0]!.steps.slice(0, 3) }] }

describe('the sky through the hooks', () => {
  test('Take off plays on through the Go turn starting: the picture keeps its bytes', PLAIN, async ($, on) => {
    const world = engine(on)
    const ui = await $.ui.mount(PANE)
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await world.clock.advance(5000)
    await ui.press({ key: 'takeoff' })
    const pressed = await skyOf(ui)
    expect(pressed?.source).toContain('keyTimes="0;0.45;1"')
    await world.clock.advance(600)
    await $.turn.start({ text: GO_TEXT, turnId: 't1' })
    expect((await skyOf(ui))?.source).toBe(pressed?.source)
    await ui.unmount()
  })

  test('the turn ending while receipts are stamped drops the stamp instead of replaying it', PLAIN, async ($, on) => {
    const world = engine(on)
    const ui = await $.ui.mount(PANE)
    await $.tool.call({ tool: TOOL, op: 'set', ...SMALL })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await write($, '/p/todo.js')
    await world.clock.advance(10_000)
    await runTests($)
    expect((await skyOf(ui))?.source).toContain('values="2 2;1 1"')
    await world.clock.advance(800)
    await $.turn.complete({ answer: 'Partly done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
    expect(await ui.find({ key: 'card-holding' })).toBeDefined()
    expect((await skyOf(ui))?.source).not.toContain('values="2 2;1 1"')
    await ui.unmount()
  })

  test('the crew stay out for the landing, and leave with the next turn', PLAIN, async ($, on) => {
    const world = engine(on)
    on('tool.call', { tool: 'Agent' }, ($, e) => ({
      result: { status: 'async_launched' as const, agentId: 'a1', description: e.description, prompt: e.prompt, outputFile: '/tmp/a1.out' },
    }))
    const ui = await $.ui.mount(PANE)
    await $.tool.call({ tool: TOOL, op: 'set', ...SMALL })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.tool.call({ tool: 'Agent', description: 'look at the old list code', prompt: 'look' })
    await $.turn.complete({ answer: 'Found it.', durationMs: 1000, isAborted: false, turnId: 't-a1', reason: 'answer', agentId: 'a1' })
    for (const path of ['/p/todo.js', '/p/todo.test.js']) await write($, path)
    await runTests($)
    await $.tool.call({ tool: TOOL, op: 'step', finish: ['s1', 's2', 's3'], outcome: 'done', evidence: 'node --test: 11 passed' })
    await world.clock.advance(5000)
    await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
    expect(await ui.find({ key: 'card-landed' })).toBeDefined()
    expect((await skyOf(ui))?.alt).toContain('Crew: 0 working, 1 back.')
    await $.turn.start({ text: 'thanks', turnId: 't2' })
    expect((await skyOf(ui))?.alt).not.toContain('Crew')
    await ui.unmount()
  })

  test('a title with a pasted terminal escape still draws, on every surface', PLAIN, async ($, on) => {
    engine(on)
    const pasted = { ...SMALL, features: [{ ...SMALL.features[0]!, title: 'Fix \u001b[31mred\u001b[0m output' }] }
    await $.tool.call({ tool: TOOL, op: 'set', ...pasted })
    for (const surface of ['desktop', 'terminal'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ text: /Fix \[31mred\[0m output/ })).toBeDefined()
      await ui.unmount()
    }
  })
})
