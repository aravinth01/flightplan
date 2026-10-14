import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Flight Plan',
  isFocused: false,
  bodyColumns: 58,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

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

// What sits beneath the plugin in a session: the engine's own answers.
function engine(on: On, sent: string[]) {
  mock.clock(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 12 }, rateLimits: [], cost: { usd: 0.42 } } }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)

    return { text: e.text, context: e.context }
  })
  on('tool.call', { tool: 'Write' }, ($, e) => ({ result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [] } }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ℹ tests 11\nℹ pass 11\nℹ fail 0', stderr: '', interrupted: false }, text: 'ℹ tests 11\nℹ pass 11\nℹ fail 0' }))
}

describe('a whole flight through the hooks', () => {
  test('route, takeoff, evidence, an edit that rides the next tool result, landing', async ($, on) => {
    const sent: string[] = []
    engine(on, sent)
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
    expect(await ui.find({ text: /ON THE GROUND/ })).toBeDefined()

    // Claude files the route: four steps, so the countdown gate holds it.
    const filed = await $.tool.call({ tool: 'mcp__flightplan__route', op: 'set', ...ROUTE })
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
    const first = await $.tool.call({ tool: 'Write', file_path: '/p/todo.js', content: 'x' })
    expect((first.context ?? []).join('\n')).toContain('removed step s4 "Short README"')
    await $.tool.call({ tool: 'Write', file_path: '/p/todo.test.js', content: 'x' })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('"type":"Svg"')

    // Writing the removed step's file is refused once, with the reason.
    const refused = await $.tool.call({ tool: 'Write', file_path: '/p/README.md', content: 'x' })
    expect(refused.deny).toContain('removed')

    // The checks pass: everything written is checked; Claude acknowledges the edit.
    await $.tool.call({ tool: 'Bash', command: 'node --test', description: 'Run the tests' })
    const reported = await $.tool.call({ tool: 'mcp__flightplan__route', op: 'step', finish: ['s1', 's2', 's3'], outcome: 'done', evidence: 'node --test: 11 passed', acks: ['e1'] })
    expect(String(reported.result)).toContain('"ok":true')

    // The turn ends: every live step closed, so the flight lands.
    await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
    expect(await ui.find({ text: /LANDED/ })).toBeDefined()
    await ui.unmount()
  })

  test('the map draws on the terminal too, with a glyph for the plane', async ($, on) => {
    engine(on, [])
    await $.tool.call({ tool: 'mcp__flightplan__route', op: 'set', ...ROUTE })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.tool.call({ tool: 'Write', file_path: '/p/todo.js', content: 'x' })
    let isFirst = true
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'flightplan', surface, component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      expect(await ui.drawn()).toMatchObject({ type: 'Box' })
      expect(await ui.find({ text: /NOW/ })).toBeDefined()
      // details is one toggle shared by every surface: press it once.
      if (isFirst) await ui.press({ key: 'details' })
      isFirst = false
      expect(await ui.find({ text: /working in: todo.js/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a narrow inline pane draws the compact card', async ($, on) => {
    engine(on, [])
    await $.tool.call({ tool: 'mcp__flightplan__route', op: 'set', ...ROUTE })
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.tool.call({ tool: 'Write', file_path: '/p/todo.js', content: 'x' })
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: { ...PANE_PROPS, bodyColumns: 40, placement: 'inline' } })
    expect(await ui.find({ text: /next: Tests cover every action/ })).toBeDefined()
    await ui.unmount()
  })
})
