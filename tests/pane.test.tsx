import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted, MockClock } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import type { Step } from '../types'
import { newRoute } from '../hooks/model'
import { chipKindOf, isFreshReceipts, stopLook } from '../hooks/pane'
import { say } from '../hooks/text'

// The pane, drawn through the real hooks on the terminal and the desktop, in
// both voices, at three widths and inline: every card state is a valid tree
// with the sky first, one Svg at most (never in a Button, none on the
// terminal or in calm), and the sky's source and alt stay byte-identical
// while only words change.

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Flight Plan',
  isFocused: false,
  bodyColumns: 63,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

const TOOL = 'mcp__flightplan__route'
const T0 = 1_760_000_000_000
const PASS = 'ℹ tests 11\nℹ pass 11\nℹ fail 0'
const FAIL = 'ℹ tests 11\nℹ pass 9\nℹ fail 2'

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
      ],
    },
    {
      id: 'f2',
      title: 'Let people share the list',
      why: 'so a family can use it',
      steps: [
        { id: 's3', title: 'Export the list as text', why: 'to paste anywhere', files: ['share.js'], check: 'node --test' },
        { id: 's4', title: 'Short README', why: 'so others can use it', files: ['README.md'], check: 'node --test' },
      ],
    },
  ],
}

const SIZES = [
  { bodyColumns: 30, placement: 'dock' },
  { bodyColumns: 63, placement: 'dock' },
  { bodyColumns: 100, placement: 'dock' },
  { bodyColumns: 30, placement: 'inline' },
  { bodyColumns: 63, placement: 'inline' },
] as const

const SURFACES = ['terminal', 'desktop'] as const
const VOICES = ['fun', 'plain'] as const

type World = { sent: string[]; bash: string; clock: MockClock }

// What sits beneath the plugin in a session: the engine's own answers. A
// question to the person waits on the test's clock until it moves on.
function engine(on: On): World {
  const world: World = { sent: [], bash: PASS, clock: mock.clock(on, { now: T0 }) }
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 12 }, rateLimits: [], cost: { usd: 0.42 } } }))
  on('prompt.submit', ($, e) => {
    world.sent.push(e.text)

    return { text: e.text, context: e.context }
  })
  on('tool.call', { tool: 'Write' }, ($, e) => ({ result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [] } }))
  on('tool.call', { tool: 'Read' }, ($, e) => ({ result: { type: 'text', file: { filePath: e.file_path, content: 'x', numLines: 1, startLine: 1, totalLines: 1 } } }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: world.bash, stderr: '', interrupted: false }, text: world.bash }))
  on('tool.call', { tool: 'Agent' }, () => ({ deny: 'helpers do not run in tests' }))
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await world.clock.sleep(60_000)

    return { result: { questions: [], answers: {} } }
  })

  return world
}

const write = ($: Engine, path: string) => $.tool.call({ tool: 'Write', file_path: path, content: 'x' })

async function runTests($: Engine, world: World, output: string) {
  world.bash = output
  await $.tool.call({ tool: 'Bash', command: 'node --test', description: 'Run the tests' })
}

// ---------------------------------------------------------------- the tree, walked

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown }
type Seen = { node: Node; inButton: boolean }

function walk(tree: unknown, inButton = false, out: Seen[] = []): Seen[] {
  if (tree === null || typeof tree !== 'object') return out
  if (Array.isArray(tree)) {
    for (const one of tree) walk(one, inButton, out)
    return out
  }
  const node = tree as Node
  out.push({ node, inButton })
  const isButton = inButton || node.type === 'Button'
  walk(node.children, isButton, out)
  walk(node.props?.children, isButton, out)

  return out
}

// Every string a tree shows, in order.
function textOf(tree: unknown): string {
  if (typeof tree === 'string') return tree
  if (tree === null || typeof tree !== 'object') return ''
  if (Array.isArray(tree)) return tree.map(textOf).join('')
  const node = tree as Node

  return `${typeof node.props?.label === 'string' ? node.props.label : ''}${textOf(node.children)}${textOf(node.props?.children)}`
}

// The sky's picture as drawn: its source and alt, or undefined.
function skyOf(tree: unknown): { source: string; alt: string } | undefined {
  const svg = walk(tree).find(seen => seen.node.type === 'Svg')?.node.props

  return svg === undefined ? undefined : { source: String(svg.source), alt: String(svg.alt) }
}

// The emoji budget (R13): only ✈️ ✅ 🎟️, in the fun voice, on the desktop, at
// most one per line, never on a Button. ✈ and ☀ without the selector are text marks.
const EMOJI = /\p{Extended_Pictographic}\uFE0F?/gu
const ALLOWED = ['✈️', '✅', '🎟️']
const MARKS = ['✈', '☀']

// Each line a tree shows: every outermost Text, and every Button's label.
function linesOf(tree: unknown, out: { text: string; isButton: boolean }[] = []): { text: string; isButton: boolean }[] {
  if (tree === null || typeof tree !== 'object') return out
  if (Array.isArray(tree)) {
    for (const one of tree) linesOf(one, out)
    return out
  }
  const node = tree as Node
  if (node.type === 'Text' || node.type === 'Button') {
    out.push({ text: textOf(node), isButton: node.type === 'Button' })
    return out
  }
  linesOf(node.children, out)
  linesOf(node.props?.children, out)

  return out
}

function expectEmojiBudget(tree: unknown, surface: string, voice: string, label: string) {
  for (const line of linesOf(tree)) {
    const emoji = [...line.text.matchAll(EMOJI)].map(match => match[0]).filter(one => !MARKS.includes(one))
    const isAllowed = surface === 'desktop' && voice === 'fun' && !line.isButton
    expect(emoji.filter(one => !isAllowed || !ALLOWED.includes(one)), `${label}: emoji in "${line.text}"`).toEqual([])
    expect(emoji.length <= 1, `${label}: one emoji per line in "${line.text}"`).toBe(true)
  }
}

// The rules every drawing keeps, whatever the state.
function expectValid(tree: unknown, surface: string, isCalm: boolean, label: string) {
  const root = tree as Node
  expect(root.type, label).toBe('Box')
  const children = Array.isArray(root.children) ? root.children : []
  expect((children[0] as Node | undefined)?.props?.key, `${label}: the sky is the root's first child`).toBe('sky')
  const seen = walk(tree)
  const svgs = seen.filter(one => one.node.type === 'Svg')
  expect(svgs.length, `${label}: Svg count`).toBe(surface === 'desktop' && !isCalm ? 1 : 0)
  for (const { node } of svgs) {
    expect(typeof node.props?.width, `${label}: Svg width`).toBe('number')
    expect(typeof node.props?.height, `${label}: Svg height`).toBe('number')
    expect(String(node.props?.alt ?? '').length > 0, `${label}: Svg alt`).toBe(true)
  }
  for (const { node, inButton } of seen) {
    if (inButton && node.type !== 'Button') {
      expect(node.type, `${label}: a Button holds strings and Text only`).toBe('Text')
      expect(node.props?.backgroundColor, `${label}: chips sit beside a Button, never in it`).toBeUndefined()
    }
    for (const [name, value] of Object.entries(node.props ?? {})) {
      if (typeof value === 'string' && /\d\.\d*%/.test(value)) throw new Error(`${label}: fractional percentage ${name}="${value}"`)
    }
  }
}

type More = (ui: Mounted<(typeof SURFACES)[number], 'Pane'>, surface: (typeof SURFACES)[number], label: string) => Promise<void>

// Mounts every surface and size, checks the card and the rules, unmounts.
async function expectCard($: Engine, card: string, voice: string, more?: More, isCalm = false) {
  for (const surface of SURFACES) {
    for (const size of SIZES) {
      const label = `${card} on ${surface} at ${size.bodyColumns} ${size.placement}`
      const ui = await $.ui.mount({ plugin: 'flightplan', surface, component: 'Pane', requestId: 'flightplan', props: { ...PANE_PROPS, ...size } })
      const tree = await ui.drawn()
      expectValid(tree, surface, isCalm, label)
      expectEmojiBudget(tree, surface, voice, label)
      expect(await ui.find({ key: `card-${card}` }), `${label}: card-${card}`).toBeDefined()
      if (more !== undefined) await more(ui, surface, label)
      await ui.unmount()
    }
  }
}

// ---------------------------------------------------------------- every card state

describe('every card draws a valid tree on every surface, width and voice', () => {
  for (const voice of VOICES) {
    test(`a whole flight, party landing (${voice})`, { options: { voice }, timeoutMs: 60_000 }, async ($, on) => {
      const world = engine(on)
      await expectCard($, 'empty', voice)

      // Filed: four steps, so the countdown holds it at the gate.
      await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
      await expectCard($, 'ready', voice, async (ui, surface, label) => {
        const tag = textOf(await ui.find({ key: 'card-ready' }))
        expect(tag.includes(voice === 'fun' ? 'NOW BOARDING' : 'READY FOR TAKEOFF'), `${label}: ready tag`).toBe(true)
        // The first stop is a full pass while boarding; the ticket only on the desktop, in fun.
        const pass = textOf(await ui.find({ key: 'wp-f1' }))
        expect(pass.includes('stop 1 of 2 · BOARDING PASS'), `${label}: pass header`).toBe(true)
        expect(pass.includes('FROM '), `${label}: pass route line`).toBe(true)
        expect(/🎟/u.test(pass), `${label}: ticket`).toBe(voice === 'fun' && surface === 'desktop')
        expect(await ui.find({ key: 'sb-s1' }), label).toBeDefined()
        expect(await ui.find({ key: 'fb-f2' }), `${label}: the second stop is a stub`).toBeDefined()
        expect(await ui.find({ key: 'sb-s3' }), `${label}: a stub hides its steps`).toBeUndefined()
      })

      const desk = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      await desk.press({ key: 'hold' })
      await desk.unmount()
      await expectCard($, 'ready', voice, async (ui, surface, label) => {
        expect(await ui.find({ key: 'hold' }), `${label}: held`).toBeUndefined()
        expect(await ui.find({ key: 'takeoff' }), label).toBeDefined()
      })

      // Take off: Claude works, the plane follows its writes.
      const gate = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      await gate.press({ key: 'takeoff' })
      await gate.unmount()
      expect(world.sent.some(text => text.startsWith('Go: take off'))).toBe(true)
      await $.turn.start({ text: 'Go: take off', turnId: 't1' })
      await write($, '/p/todo.js')
      await $.tool.call({ tool: TOOL, op: 'decide', question: 'Where to keep the list?', choice: 'a JSON file', alternatives: ['SQLite'], why: 'simplest' })
      await $.tool.call({ tool: 'Agent', description: 'look at the old list code', prompt: 'look' })
      await expectCard($, 'now', voice, async (ui, surface, label) => {
        const tag = textOf(await ui.find({ key: 'card-now' }))
        expect(tag.includes(voice === 'fun' ? 'IN THE AIR' : 'NOW'), `${label}: now tag`).toBe(true)
        if (label.includes('inline')) {
          expect(textOf(await ui.drawn()).includes('next: Tests cover every action'), `${label}: compact next`).toBe(true)
        } else {
          expect(await ui.find({ key: 'db-d1' }), `${label}: decision`).toBeDefined()
          expect(await ui.find({ key: 'wp-f1' }), `${label}: the plane's stop is a pass`).toBeDefined()
          // The helper's call was refused (the mock denies it): it never went out, so it hit a snag, not "reported back".
          const crew = await ui.find({ text: voice === 'fun' ? /crew · hit a snag · look at the old list code/ : /helper · ran into a problem · look at the old list code/ })
          expect(crew, `${label}: crew row`).toBeDefined()
        }
      })

      // Three failing runs in a row: turbulence.
      for (let i = 0; i < 3; i++) await runTests($, world, FAIL)
      await expectCard($, 'turbulence', voice, async (ui, surface, label) => {
        expect(await ui.find({ key: 'nudge' }), label).toBeDefined()
        expect(await ui.find({ key: 'skipstuck' }), label).toBeDefined()
      })

      // A passing run: receipts for the step it covered, flashed for 2.5 s.
      await runTests($, world, PASS)
      await expectCard($, 'now', voice, async (ui, surface, label) => {
        if (label.includes('inline')) return
        const chips = walk(await ui.find({ key: 'sr-s1' })).filter(one => one.node.props?.backgroundColor === 'success')
        expect(chips.length, `${label}: fresh receipts chip`).toBe(1)
        expect(textOf(chips[0]?.node).includes(voice === 'fun' ? 'receipts' : 'checked'), label).toBe(true)
        expect(textOf(chips[0]?.node).includes('✅'), `${label}: ✅ only in fun on the desktop`).toBe(voice === 'fun' && surface === 'desktop')
      })
      await world.clock.advance(5000)
      const later = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      expect(walk(await later.find({ key: 'sr-s1' })).filter(one => one.node.props?.backgroundColor === 'success').length, 'the flash ends').toBe(0)
      await later.unmount()

      // Claude asks the person something: the card waits for them.
      const asking = $.tool.call({
        tool: 'AskUserQuestion',
        questions: [{ question: 'Keep done items?', header: 'Done items', multiSelect: false, options: [{ label: 'Keep', description: 'k' }, { label: 'Hide', description: 'h' }] }],
      })
      await world.clock.settle()
      await expectCard($, 'ask', voice, async (ui, surface, label) => {
        expect(textOf(await ui.find({ key: 'card-ask' })).includes('Keep done items?'), label).toBe(true)
      })
      await world.clock.advance(60_000)
      await asking

      // Paused after this step, then the turn ends.
      const now = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      await now.press({ key: 'pause' })
      await now.unmount()
      await $.turn.complete({ answer: 'Paused.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
      await expectCard($, 'paused', voice)

      // Continue: the person's turn while Claude is not running.
      const paused = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
      await paused.press({ key: 'resume' })
      await paused.unmount()
      await expectCard($, 'holding', voice)

      // The rest of the work, one passing run, and the turn ends: every step has receipts.
      await $.turn.start({ text: 'Continue the route from where you stopped.', turnId: 't2' })
      for (const path of ['/p/todo.test.js', '/p/share.js', '/p/README.md']) await write($, path)
      await runTests($, world, PASS)
      await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })
      await expectCard($, 'landed', voice, async (ui, surface, label) => {
        const card = textOf(await ui.find({ key: 'card-landed' }))
        expect(card.includes(voice === 'fun' ? 'TOUCHDOWN' : 'LANDED'), `${label}: party tag`).toBe(true)
        expect(card.includes('we ate'), `${label}: we ate`).toBe(voice === 'fun')
      })
    })

    test(`a landing nobody tested is quiet (${voice})`, { options: { voice }, timeoutMs: 60_000 }, async ($, on) => {
      engine(on)
      await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
      await $.turn.start({ text: 'go', turnId: 't1' })
      for (const path of ['/p/todo.js', '/p/todo.test.js', '/p/share.js', '/p/README.md']) await write($, path)
      await $.turn.complete({ answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
      await expectCard($, 'landed', voice, async (ui, surface, label) => {
        const card = textOf(await ui.find({ key: 'card-landed' }))
        expect(card.includes('LANDED'), `${label}: quiet tag`).toBe(true)
        expect(/TOUCHDOWN|we ate|✅/u.test(card), `${label}: nothing celebrated`).toBe(false)
        expect(await ui.find({ key: 'askcheck' }), `${label}: ask Claude to check`).toBeDefined()
        // The route's landing flag is green only after a party.
        const flags = walk(await ui.drawn()).filter(one => one.node.type === 'Text' && textOf(one.node) === '⚑')
        expect(flags.length > 0, `${label}: a landing flag`).toBe(true)
        expect(flags.some(one => one.node.props?.color === 'success'), `${label}: no green flag`).toBe(false)
      })
    })
  }

  test('calm draws no Svg anywhere, and the sky still comes first', { options: { fun: 'calm' }, timeoutMs: 60_000 }, async ($, on) => {
    engine(on)
    await expectCard($, 'empty', 'fun', undefined, true)
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
    await expectCard($, 'ready', 'fun', undefined, true)
    await $.turn.start({ text: 'go', turnId: 't1' })
    await write($, '/p/todo.js')
    await expectCard(
      $,
      'now',
      'fun',
      async (ui, surface, label) => {
        expect(textOf(await ui.find({ key: 'sky' })).includes('⚑'), `${label}: the text sky`).toBe(true)
      },
      true,
    )
  })
})

// ---------------------------------------------------------------- the band

const BAND_PROPS: RenderPropsOf['AbovePrompt'] = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} }

describe('the band above the prompt, while the map is off screen', () => {
  for (const voice of VOICES) {
    test(`one line, its buttons and no Svg (${voice})`, { options: { voice } }, async ($, on) => {
      engine(on)
      on('ui.panes', () => ({ value: [] }))
      await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })
      for (const surface of SURFACES) {
        const band = await $.ui.mount({ plugin: 'flightplan', surface, component: 'AbovePrompt', props: BAND_PROPS })
        const tree = await band.drawn()
        expect(walk(tree).some(one => one.node.type === 'Svg')).toBe(false)
        expect(textOf(tree).includes(voice === 'fun' ? 'Now boarding: 4 steps' : 'Route ready: 4 steps')).toBe(true)
        expect(await band.find({ key: 'band-open' })).toBeDefined()
        expect(await band.find({ key: 'band-takeoff' })).toBeDefined()
        expect(await band.find({ key: 'band-hold' })).toBeDefined()
        await band.unmount()
      }
    })
  }
})

// ---------------------------------------------------------------- byte stability

describe('the sky keeps its bytes while only words change', () => {
  test('countdown ticks, a details toggle and an activity change leave the Svg alone', { timeoutMs: 30_000 }, async ($, on) => {
    const world = engine(on)
    const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: PANE_PROPS })
    await $.tool.call({ tool: TOOL, op: 'set', ...ROUTE })

    // At the gate: the countdown redraws the card every second.
    const before = await ui.drawn()
    await world.clock.advance(1000)
    const tick1 = await ui.drawn()
    await world.clock.advance(1000)
    const tick2 = await ui.drawn()
    expect(JSON.stringify(tick1)).not.toBe(JSON.stringify(before))
    expect(JSON.stringify(tick2)).not.toBe(JSON.stringify(tick1))
    expect(skyOf(before)).toBeDefined()
    expect(skyOf(tick1)).toEqual(skyOf(before))
    expect(skyOf(tick2)).toEqual(skyOf(before))

    // In the air, once the take-off and the glide are over.
    await ui.press({ key: 'takeoff' })
    await $.turn.start({ text: 'Go: take off', turnId: 't1' })
    await write($, '/p/todo.js')
    await world.clock.advance(3000)
    await ui.press({ key: 'details' })
    const details = await ui.drawn()
    expect(textOf(details).includes('working in: todo.js')).toBe(true)
    await $.tool.call({ tool: 'Read', file_path: '/p/notes.md' })
    const reading = await ui.drawn()
    expect(textOf(reading).includes('reading notes.md')).toBe(true)
    await ui.press({ key: 'details' })
    const hidden = await ui.drawn()
    expect(textOf(hidden).includes('working in:')).toBe(false)
    expect(skyOf(details)).toBeDefined()
    expect(skyOf(reading)).toEqual(skyOf(details))
    expect(skyOf(hidden)).toEqual(skyOf(details))
    await ui.unmount()
  })
})

// ---------------------------------------------------------------- honesty

const STEP: Step = { id: 's1', featureId: 'f1', title: 'A step', why: '', files: [], check: 'node --test', status: 'pending', written: [] }

describe('the one honesty mapping for step chips', () => {
  test('receipts only for a run the map saw pass; everyone keeps their own word', () => {
    expect(chipKindOf({ ...STEP, status: 'checked', doneBy: 'seen' }, false)).toBe('receipts')
    expect(chipKindOf({ ...STEP, status: 'checked', doneBy: 'claude' }, false)).toBe('receipts')
    expect(chipKindOf({ ...STEP, status: 'checked', doneBy: 'you' }, false)).toBe('youChecked')
    expect(chipKindOf({ ...STEP, status: 'done', doneBy: 'claude', claim: 'node --test: 11 passed' }, false)).toBe('claudeSays')
    expect(chipKindOf({ ...STEP, status: 'done', doneBy: 'claude', claim: 'none' }, false)).toBe('untested')
    expect(chipKindOf({ ...STEP, status: 'done', doneBy: 'seen' }, false)).toBe('untested')
    expect(chipKindOf({ ...STEP, status: 'failed' }, true)).toBe('failed')
    expect(chipKindOf({ ...STEP, status: 'active' }, true)).toBe('now')
    expect(chipKindOf({ ...STEP, status: 'active' }, false)).toBe('started')
    expect(chipKindOf({ ...STEP, status: 'skipped', doneBy: 'you' }, false)).toBe('youSkipped')
    expect(chipKindOf({ ...STEP, status: 'skipped', doneBy: 'claude' }, false)).toBe('skipped')
    expect(chipKindOf({ ...STEP, status: 'blocked' }, false)).toBe('blocked')
    expect(chipKindOf({ ...STEP, status: 'removed', removedBy: 'claude' }, false)).toBe('claudeDropped')
    expect(chipKindOf({ ...STEP, status: 'removed', removedBy: 'you' }, false)).toBe('youRemoved')
    expect(chipKindOf(STEP, true)).toBe('pending')
  })

  test('the receipts flash lasts 2.5 s, and never for the person\'s own check', () => {
    const seen: Step = { ...STEP, status: 'checked', doneBy: 'seen', checkedAt: 10_000 }
    expect(isFreshReceipts(seen, 10_000)).toBe(true)
    expect(isFreshReceipts(seen, 12_499)).toBe(true)
    expect(isFreshReceipts(seen, 12_500)).toBe(false)
    expect(isFreshReceipts(seen, 9_000)).toBe(false)
    expect(isFreshReceipts({ ...seen, doneBy: 'you' }, 10_000)).toBe(false)
    expect(isFreshReceipts({ ...STEP, status: 'checked', doneBy: 'seen' }, 10_000)).toBe(false)
  })
})

describe("a stop's chip claims no more than its steps", () => {
  const stop = (statuses: [Step['status'], Step['doneBy']][]) => {
    const route = newRoute(0)
    route.features = [{ id: 'f1', title: 'Log in with Google', why: '' }]
    route.steps = statuses.map(([status, doneBy], i) => ({ ...STEP, id: `s${i + 1}`, status, ...(doneBy !== undefined ? { doneBy } : {}) }))
    return stopLook(route, route.features[0]!, route.steps, false)
  }

  test('every step with receipts: "all receipts"', () => {
    expect(stop([['checked', 'seen'], ['checked', 'claude']])).toEqual({ mark: '✓', color: 'success', chip: 'stop.chip.checked' })
  })

  test(`receipts and the person's sign-off: green, but never "all receipts" or "all tested"`, () => {
    for (const yours of [['checked', 'you'], ['skipped', 'you']] as [Step['status'], Step['doneBy']][]) {
      const look = stop([['checked', 'seen'], yours])
      expect(look.color).toBe('success')
      expect(look.chip).toBe('stop.chip.checkedYours')
      for (const voice of ['fun', 'plain'] as const) expect(say('stop.chip.checkedYours', voice)).not.toMatch(/\ball\b|✅/)
    }
  })

  test('"no receipts yet" only when no step in the stop has receipts', () => {
    expect(stop([['done', 'seen'], ['done', 'claude']]).chip).toBe('stop.chip.untested')
    expect(stop([['checked', 'seen'], ['done', 'seen']]).chip).toBe(null)
    expect(stop([['checked', 'seen'], ['skipped', 'claude']]).chip).toBe(null)
  })
})

describe('the signs under the sky', () => {
  test('never run together: each keeps a free cell in its share', { timeoutMs: 30_000 }, async ($, on) => {
    engine(on)
    const titles = ['Let people log in', 'Keep a to-do list', 'Tests cover every action', 'Add the README', 'Sync across devices', 'Dark mode toggle', 'Export to CSV', 'Ship it']
    const features = titles.map((title, i) => ({ id: `f${i + 1}`, title, why: '', steps: [{ id: `s${i + 1}`, title: 'A step', why: '', files: [`f${i + 1}.js`], check: 'node --test' }] }))
    let rows = 0
    for (const n of [3, 7, 8]) {
      await $.tool.call({ tool: TOOL, op: 'set', goal: 'Many stops', features: features.slice(0, n) })
      for (const bodyColumns of [30, 63, 100]) {
        const ui = await $.ui.mount({ plugin: 'flightplan', surface: 'desktop', component: 'Pane', requestId: 'flightplan', props: { ...PANE_PROPS, bodyColumns } })
        const row = await ui.find({ key: 'signs' })
        if (row !== undefined) {
          rows += 1
          const shares = walk(row).filter(one => one.node.type === 'Box' && String(one.node.props?.key ?? '').startsWith('sign-'))
          const left = walk(row).find(one => one.node.props?.key === 'signs-left')?.node.props?.width
          const right = walk(row).find(one => one.node.props?.key === 'signs-right')?.node.props?.width
          const cells = Number((row as Node).props?.width) - Number(left ?? 0) - Number(right ?? 0)
          const room = Math.floor(cells / n) - 1
          expect(shares).toHaveLength(n)
          for (const share of shares) expect([...textOf(share.node)].length, `${n} stops at ${bodyColumns}: "${textOf(share.node)}"`).toBeLessThanOrEqual(room)
        }
        await ui.unmount()
      }
      await $.turn.start({ text: 'next', turnId: `t${n}` })
      await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: `t${n}`, reason: 'answer' })
    }
    // 7 and 8 stops at 63 columns (5 to 6 cells a share) still draw their signs.
    expect(rows).toBeGreaterThanOrEqual(6)
  })
})
