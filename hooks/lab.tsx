import type { BoxProps, ButtonProps, ElementConstructor, RenderElement, SvgProps, TextProps } from 'claude-code'

import { sprite } from './pixels'
import type { Grid, Palette } from './pixels'

// The lab (/flight lab): a throwaway page that answers, in the real desktop
// app, what the engine does with animated pictures before v2 relies on it.
// Each check says what "works" looks like; the person taps what they see and
// the answers are saved for Claude to read. Removed before the v2 release.

export type LabElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Svg?: ElementConstructor<SvgProps>
}

export type LabPage = 'redraw' | 'pictures' | 'busy'

export type LabDraw = {
  page: LabPage
  tick: number
  replay: number
  columns: number
  placement: string
  answers: Readonly<Record<string, string>>
  isDone: boolean
}

export type LabActions = {
  page: (page: LabPage) => void
  answer: (id: string, value: string) => void
  toggle: (id: string, item: string) => void
  replay: () => void
  done: () => void
}

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const INK = '#2B1D16'
const CREAM = '#FFF4E0'
const GREEN = '#2E9E5B'
const RED = '#D64545'
const ORANGE = '#D97757'
const AMBER = '#F2A93B'
const TRACK = '#E8DCC8'

const BANNER = 'width="960" height="240"'
const STRIP = 'width="960" height="120"'

function svg(w: number, h: number, size: string, body: string, head = ''): string {
  return `<svg ${NS}${head} viewBox="0 0 ${w} ${h}" ${size} preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">${body}</svg>`
}

// A 1-unit ink frame drawn as filled rects (no strokes), on a cream card.
function card(w: number, h: number): string {
  return `<rect width="${w}" height="${h}" fill="${CREAM}"/><path fill="${INK}" d="M0 0h${w}v1h-${w}zM0 ${h - 1}h${w}v1h-${w}zM0 0h1v${h}h-1zM${w - 1} 0h1v${h}h-1z"/>`
}

// ------------------------------------------------------------ S1 sizing

function ruler(size: string): string {
  const ticks = Array.from({ length: 13 }, (_, i) => `M${Math.min(i * 16, 191)} 1h1v${i % 4 === 0 ? 10 : 5}h-1z`).join('')
  const body = `${card(192, 48)}<path fill="${INK}" d="${ticks}"/><rect x="2" y="19" width="8" height="10" fill="${GREEN}"/><rect x="182" y="19" width="8" height="10" fill="${GREEN}"/><circle cx="96" cy="26" r="14" fill="${ORANGE}"/>`

  return svg(192, 48, size, body)
}

// ------------------------------------------------------------ S2 redraws

// A green bar that fills the track over 10 seconds, then starts over. If a
// redraw restarts the animation, it never gets past the first tenth.
const SWEEP = (() => {
  const marks = Array.from({ length: 11 }, (_, i) => `M${8 + Math.round(i * 17.6)} 17h1v3h-1z`).join('')
  const body = `${card(192, 24)}<rect x="8" y="7" width="176" height="8" fill="${TRACK}"/><path fill="${INK}" d="${marks}"/><rect x="8" y="7" width="0" height="8" fill="${GREEN}"><animate attributeName="width" values="0;176" dur="10s" repeatCount="indefinite"/></rect><rect x="185" y="4" width="3" height="14" fill="${GREEN}"/>`

  return svg(192, 24, STRIP, body)
})()

// ------------------------------------------------------------ S3 pixels and theme

const PLANE: Grid = [
  '.KKK......................',
  '.KOOK.....................',
  '.KOOOK....................',
  '.KOOOOKKKKKKKKKKKKKK......',
  'KOOOOOOOOOOOOOOOOOOOKK....',
  'KOOOOOOOOOOOOOOOKWWWOOK...',
  'KOOOCOOCOOCOOOOOKWwWOOOK..',
  'KCCCCCCCCCCCCCCCCCCCCCCCKK',
  'KoooooooooooooooooooooooK.',
  '.KKoooooKKKKKKKKKoooooKK..',
  '...KKKKKKoooooooKKKKKK....',
  '........KoooooooK.........',
  '.........KKKKKKK..........',
]
const PROP_A: Grid = ['K', 'K', 'K', 'K', 'K', '.', '.', 'K', 'K', 'K', 'K', 'K']
const PROP_B: Grid = ['.', '.', '.', 'K', 'K', '.', '.', 'K', 'K', '.', '.', '.']
const PROP_C: Grid = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p']
const PAL: Palette = { K: INK, O: ORANGE, o: '#B5563A', C: CREAM, W: '#9ED8F0', w: '#FFFFFF', p: '#8C7F75', N: '#23395B', S: '#E9B48A', F: '#FFFFFF', c: '#D6E8F5', Y: '#F2B13C' }

function planeSvg(isCrisp: boolean): string {
  const body = `<rect width="64" height="20" fill="#A9D8F5"/>${sprite(PLANE, PAL, 18, 3)}`
  const svgText = svg(64, 20, 'width="960" height="300"', body)

  return isCrisp ? svgText : svgText.replace(' shape-rendering="crispEdges"', ' shape-rendering="geometricPrecision"')
}

const THEME = svg(
  64,
  16,
  'width="960" height="240"',
  `<style>.t{fill:${ORANGE}}@media (prefers-color-scheme: dark){.t{fill:#7C5CFF}}</style>${card(64, 16)}<rect class="t" x="24" y="2" width="16" height="12" fill="#8C8A93"/>`,
)

// ------------------------------------------------------------ S4 what the scrub keeps

// Six cells. Cells 1-5 are green when the feature survives and red when it was
// stripped. Cell 6 turns blue under the pointer and has a tooltip.
const SCRUB = (() => {
  const x = (i: number) => 6 + i * 31
  const red = (i: number) => `<rect x="${x(i)}" y="4" width="24" height="24" fill="${RED}"/>`
  const defs = `<defs><g id="ok"><rect width="24" height="24" fill="${GREEN}"/></g><pattern id="pg" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${GREEN}"/><rect width="2" height="2" fill="#7FD39B"/></pattern><clipPath id="nothing"><rect width="0" height="0"/></clipPath></defs>`
  const style = `<style>.ok5{fill:${GREEN}}.hv{fill:${AMBER}}.hv:hover{fill:#4FA3E3}</style>`
  const cells = [
    `${red(0)}<use href="#ok" x="${x(0)}" y="4"/>`,
    `${red(1)}<use xlink:href="#ok" x="${x(1)}" y="4"/>`,
    `${red(2)}<rect x="${x(2)}" y="4" width="24" height="24" fill="url(#pg)"/>`,
    `<rect x="${x(3)}" y="4" width="24" height="24" fill="${GREEN}"/><rect x="${x(3)}" y="4" width="24" height="24" fill="${RED}" clip-path="url(#nothing)"/>`,
    `<rect class="ok5" x="${x(4)}" y="4" width="24" height="24" fill="${RED}"/>`,
    `<g><title>tooltip works</title><rect class="hv" x="${x(5)}" y="4" width="24" height="24"/></g>`,
  ]
  const numbers = cells.map((_, i) => `<path fill="${INK}" d="${pips(x(i), i + 1)}"/>`).join('')

  return svg(192, 36, 'width="960" height="180"', `${defs}${style}${card(192, 36)}${cells.join('')}${numbers}`, ' xmlns:xlink="http://www.w3.org/1999/xlink"')
})()

// Small dots under a cell, one per number (no words inside the picture).
function pips(x: number, n: number): string {
  return Array.from({ length: n }, (_, i) => `M${x + i * 4} 30h2v2h-2z`).join('')
}

// ------------------------------------------------------------ S5 animation vocabulary

// Eight lanes: a red start zone on the left, a green finish zone on the right.
// Lanes 1-5, 7 and 8 end in green and stay there; lane 6 blinks forever.
function lanes(nonce: number): string {
  const y = (i: number) => 3 + i * 9
  const zones = Array.from({ length: 8 }, (_, i) => `<rect x="2" y="${y(i)}" width="22" height="8" fill="#F6C7C7"/><rect x="84" y="${y(i)}" width="16" height="8" fill="#FBE3B8"/><rect x="164" y="${y(i)}" width="24" height="8" fill="#BFE6CC"/>`).join('')
  const box = (i: number, inner: string, extra = '') => `<rect x="8" y="${y(i) + 1}" width="6" height="6" fill="${INK}"${extra}>${inner}</rect>`
  const runs = [
    box(0, '<animateTransform attributeName="transform" type="translate" from="0 0" to="160 0" dur="1.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>'),
    box(1, '<animateMotion path="M0 0 C40 -4 120 4 160 0" dur="1.4s" fill="freeze"/>'),
    box(2, '<set attributeName="x" to="168" begin="1s"/>'),
    box(3, '<animate attributeName="x" from="8" to="168" dur="6s" begin="-5s" fill="freeze"/>'),
    box(4, '<animateTransform attributeName="transform" type="translate" from="0 0" to="80 0" dur="1s" fill="freeze" additive="sum"/><animateTransform attributeName="transform" type="translate" from="0 0" to="80 0" dur="1s" fill="freeze" additive="sum"/>'),
    `<rect x="170" y="${y(5) + 1}" width="6" height="6" fill="${INK}"><animate attributeName="visibility" values="visible;hidden" dur="0.4s" calcMode="discrete" repeatCount="indefinite"/></rect>`,
    box(6, '<animateMotion path="M0 0 H160" keyPoints="0;0.5;1" keyTimes="0;0.8;1" calcMode="linear" dur="1.4s" fill="freeze"/>'),
    box(7, '<animateTransform attributeName="transform" type="translate" values="0 0;80 0;160 0" calcMode="discrete" dur="1.2s" fill="freeze"/>'),
  ]
  const numbers = Array.from({ length: 8 }, (_, i) => `<path fill="${INK}" d="${Array.from({ length: i + 1 }, (_, k) => `M${26 + k * 3} ${y(i) + 3}h2v2h-2z`).join('')}"/>`).join('')

  return svg(192, 76, 'width="960" height="380"', `${card(192, 76)}${zones}${numbers}${runs.join('')}<!--${nonce}-->`)
}

// ------------------------------------------------------------ S7 signs row

function towers(n: number): string {
  const body = Array.from({ length: n }, (_, i) => {
    const cx = Math.round(((i + 0.5) * 192) / n)

    return `<rect x="${cx - 2}" y="5" width="5" height="15" fill="${i % 2 === 0 ? ORANGE : GREEN}"/><rect x="${cx}" y="3" width="1" height="2" fill="${RED}"/>`
  }).join('')

  return svg(192, 24, STRIP, `${card(192, 24)}<rect x="1" y="20" width="190" height="3" fill="#8C8A93"/>${body}`)
}

// ------------------------------------------------------------ the busy sky (CPU)

const CLOUD_BIG: Grid = ['.....FFFF.......', '...FFFFFFFF.FF..', '..FFFFFFFFFFFFF.', 'FFFFFFFFFFFFFFFF', 'cccccccccccccccc', '.cccccccccccccc.']
const CLOUD_SMALL: Grid = ['...FFF....', '.FFFFFFFF.', 'FFFFFFFFFF', '.cccccccc.']
const CREW_STAND: Grid = ['........', '..hhhh..', '.hhhhhhh', '..ssss..', '..sKsK..', '..ssss..', '.tttttt.', 'stttttts', '.tttttt.', '..bbbb..', '..b..b..', '..b..b..', '.KK..KK.']
const CREW_CHEER: Grid = ['s......s', 't.hhhh.t', 'thhhhhht', 't.ssss.t', 't.sKsK.t', 't.sKKs.t', '.tttttt.', '.tttttt.', '.tttttt.', '..bbbb..', '.bb..bb.', '.K....K.', '........']
const SUN_BODY: Grid = ['.........', '.........', '...YYY...', '..YYYYY..', '..YYYYY..', '..YYYYY..', '...YYY...', '.........', '.........']
const SUN_RAYS_A: Grid = ['....Y....', '.........', '.........', '.........', 'Y.......Y', '.........', '.........', '.........', '....Y....']
const SUN_RAYS_B: Grid = ['.........', '.Y.....Y.', '.........', '.........', '.........', '.........', '.........', '.Y.....Y.', '.........']
const CREWS: Palette[] = [
  { h: '#F7D046', t: '#FF8A1F', b: '#3E4A5C', s: '#F2C29B', K: INK },
  { h: '#2F8F8A', t: '#2F8F8A', b: '#23395B', s: '#C68A5E', K: INK },
  { h: '#3E6FB0', t: '#3E6FB0', b: '#2B3A55', s: '#8D5A3B', K: INK },
]

function frames(list: string[], each: number): string {
  const dur = `${(each * list.length).toFixed(2)}s`

  return list
    .map((frame, i) => {
      const values = list.map((_, k) => (k === i ? 'visible' : 'hidden')).join(';')

      return `<g visibility="${i === 0 ? 'visible' : 'hidden'}">${frame}<animate attributeName="visibility" values="${values}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/></g>`
    })
    .join('')
}

function cloudLayer(clouds: [Grid, number, number][], dur: number): string {
  const one = clouds.map(([grid, x, y]) => sprite(grid, PAL, x, y)).join('')

  return `<g>${one}<g transform="translate(192 0)">${one}</g><animateTransform attributeName="transform" type="translate" from="0 0" to="-192 0" dur="${dur}s" repeatCount="indefinite"/></g>`
}

const BUSY = (() => {
  const sky = ['#4FA3E3', '#7CC0EE', '#A9D8F5', '#D9F0FB'].map((fill, i) => `<rect y="${i * 9}" width="192" height="9" fill="${fill}"/>`).join('')
  const ground = `<rect y="36" width="192" height="12" fill="#6DBE6A"/><rect y="36" width="192" height="2" fill="#57A457"/>`
  const sun = `<g transform="translate(160 3)">${sprite(SUN_BODY, { Y: '#FFD54F' }, 0, 0)}${frames([sprite(SUN_RAYS_A, { Y: '#FFD54F' }, 0, 0), sprite(SUN_RAYS_B, { Y: '#FFD54F' }, 0, 0)], 2)}</g>`
  const far = cloudLayer([[CLOUD_SMALL, 10, 6], [CLOUD_SMALL, 70, 3], [CLOUD_SMALL, 130, 9]], 60)
  const near = cloudLayer([[CLOUD_BIG, 30, 18], [CLOUD_BIG, 120, 13]], 36)
  const prop = frames([sprite(PROP_A, PAL, 25, 2), sprite(PROP_B, PAL, 25, 2), sprite(PROP_C, PAL, 25, 2)], 0.08)
  const trail = [-3, -7, -11].map((dx, i) => `<rect x="${dx}" y="${7 + (i % 2)}" width="2" height="1" fill="${CREAM}"><animate attributeName="opacity" values="1;0.2;1" dur="0.9s" begin="${(i * 0.3).toFixed(1)}s" repeatCount="indefinite"/></rect>`).join('')
  const plane = `<g transform="translate(70 12)"><g>${sprite(PLANE, PAL, 0, 0)}${prop}${trail}<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" calcMode="discrete" dur="1.2s" repeatCount="indefinite"/></g></g>`
  const crew = CREWS.map((pal, i) => `<g transform="translate(${24 + i * 12} 34)">${frames([sprite(CREW_STAND, pal, 0, 0), sprite(CREW_CHEER, pal, 0, 0)], 0.6)}</g>`).join('')

  return svg(192, 48, BANNER, `${sky}${sun}${far}${ground}${near}${plane}${crew}`)
})()

// ------------------------------------------------------------ the page

const PAGES: [LabPage, string][] = [
  ['redraw', '1 Redraws'],
  ['pictures', '2 Pictures'],
  ['busy', '3 Busy sky'],
]

export function drawLab(el: LabElements, d: LabDraw, act: LabActions): RenderElement {
  const { Box, Text, Button } = el
  const Svg = el.Svg
  if (Svg === undefined) {
    return (
      <Box flexDirection="column">
        <Text bold>Flight Plan lab</Text>
        <Text dimColor wrap="wrap">The lab checks pictures, so it needs the Claude desktop app. Open it there with /flight lab.</Text>
      </Box>
    )
  }

  const ask = (id: string, prompt: string, options: string[]) => (
    <Box key={`q-${id}`} flexDirection="column" marginTop={1}>
      <Text wrap="wrap">{prompt}</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {options.map((option, i) => (
          <Button key={`q-${id}-${i}`} label={d.answers[id] === option ? `● ${option}` : option} variant={d.answers[id] === option ? 'primary' : undefined} onPress={() => act.answer(id, option)} />
        ))}
      </Box>
    </Box>
  )
  // A row of numbered toggles: which items failed. "none" clears them.
  const pick = (id: string, prompt: string, items: string[]) => {
    const chosen = new Set((d.answers[id] ?? '').split(',').filter(item => item !== '' && item !== 'none'))

    return (
      <Box key={`p-${id}`} flexDirection="column" marginTop={1}>
        <Text wrap="wrap">{prompt}</Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button key={`p-${id}-none`} label={d.answers[id] === 'none' ? '● none, all good' : 'none, all good'} variant={d.answers[id] === 'none' ? 'primary' : undefined} onPress={() => act.answer(id, 'none')} />
          {items.map(item => (
            <Button key={`p-${id}-${item}`} label={chosen.has(item) ? `● ${item}` : item} variant={chosen.has(item) ? 'primary' : undefined} onPress={() => act.toggle(id, item)} />
          ))}
        </Box>
      </Box>
    )
  }
  const heading = (key: string, text: string) => (
    <Box key={key} marginTop={1}>
      <Text bold color="claude">
        {text}
      </Text>
    </Box>
  )
  const picture = (key: string, source: string, alt: string, size?: { width: number; height: number }) => (
    <Box key={key} flexDirection="column" width="100%" flexShrink={0}>
      <Svg source={source} alt={alt} isInteractive {...(size ?? {})} />
    </Box>
  )

  const top = (
    <Box key="top" flexDirection="column">
      <Text bold>Flight Plan lab</Text>
      <Text dimColor wrap="wrap">{`Three quick pages. Each check says what "works" looks like: tap what you see. Your taps save as you go. · tick ${d.tick} · ${d.columns} columns · ${d.placement}`}</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {PAGES.map(([page, label]) => (
          <Button key={`page-${page}`} label={label} variant={d.page === page ? 'primary' : undefined} onPress={() => act.page(page)} />
        ))}
        <Button key="done" label={d.isDone ? 'Sent to Claude ✓' : "I'm done"} onPress={() => act.done()} />
      </Box>
    </Box>
  )

  let body: RenderElement[]
  if (d.page === 'redraw') {
    const toggled = d.tick % 2 === 1
    body = [
      heading('h2', 'Do animations survive a redraw?'),
      <Text key="i2" dimColor wrap="wrap">
        This page redraws itself every second (watch the tick count above). Each green bar takes 10 seconds to fill. Watch each one for about 15 seconds.
      </Text>,
      <Text key="t2a" wrap="wrap">{`A · the words around it change every second (now: ${d.tick})`}</Text>,
      picture('s2a', SWEEP, 'A green bar filling over ten seconds'),
      ask('s2a', 'Bar A:', ['fills all the way', 'keeps jumping back']),
      <Text key="t2b">B · its description for screen readers changes every second</Text>,
      picture('s2b', SWEEP, `A green bar filling over ten seconds (${d.tick})`),
      ask('s2b', 'Bar B:', ['fills all the way', 'keeps jumping back']),
      <Text key="t2c">C · a line above it appears and disappears (labeled box)</Text>,
      <Box key="g2c" flexDirection="column">
        {toggled ? <Text key="flip-c" dimColor>(here now)</Text> : ''}
        <Box key="c-sky" flexDirection="column" width="100%">
          <Svg source={SWEEP} alt="A green bar filling over ten seconds" isInteractive />
        </Box>
      </Box>,
      ask('s2c', 'Bar C:', ['fills all the way', 'keeps jumping back']),
      <Text key="t2d">D · same, without a label on the box</Text>,
      <Box key="g2d" flexDirection="column">
        {toggled ? <Text dimColor>(here now)</Text> : null}
        <Box flexDirection="column" width="100%">
          <Svg source={SWEEP} alt="A green bar filling over ten seconds" isInteractive />
        </Box>
      </Box>,
      ask('s2d', 'Bar D:', ['fills all the way', 'keeps jumping back']),
      <Text key="t2e">E · for comparison: this picture really is new every second</Text>,
      picture('s2e', `${SWEEP}<!--${d.tick}-->`, 'A green bar that restarts every second'),
      ask('s2e', 'Bar E (expected to jump back):', ['fills all the way', 'keeps jumping back']),
    ]
  } else if (d.page === 'pictures') {
    const px = Math.max(80, Math.floor(d.columns * 8 * 0.98))
    body = [
      heading('h1', 'Does the picture fill the width?'),
      <Text key="i1" dimColor wrap="wrap">
        Four ways to size the same picture. Works = the frame touches both sides of this pane, both green blocks show, and the orange circle is round.
      </Text>,
      <Text key="t1a">Way 1</Text>,
      picture('s1a', ruler(BANNER), 'Sizing test, way 1'),
      <Text key="t1b">Way 2</Text>,
      picture('s1b', ruler(''), 'Sizing test, way 2'),
      <Text key="t1c">Way 3</Text>,
      picture('s1c', ruler('width="100%" height="auto"'), 'Sizing test, way 3'),
      <Text key="t1d">Way 4</Text>,
      picture('s1d', ruler(''), 'Sizing test, way 4', { width: px, height: Math.floor(px / 4) }),
      pick('s1', 'Which ways fill the width properly? Tap every one that does.', ['1', '2', '3', '4']),
      <Text key="s1-hint" dimColor wrap="wrap">
        Then drag the pane wider or narrower once and look again.
      </Text>,
      ask('s1r', 'After resizing, the good ones still fill it:', ['yes', 'no']),

      heading('h3', 'Pixels and light/dark'),
      picture('s3a', planeSvg(true), 'A pixel plane, sharp'),
      picture('s3b', planeSvg(false), 'A pixel plane, smoothed'),
      ask('s3', 'Top plane: sharp blocky pixels, no thin lines between them?', ['sharp', 'thin lines', 'blurry']),
      picture('s3t', THEME, 'A square that follows the app theme'),
      ask('s3m', 'The square is purple in a dark app theme and orange in a light one:', ['matches the app', 'always orange', 'grey']),

      heading('h4', 'Which picture features survive?'),
      <Text key="i4" dimColor wrap="wrap">
        Cells 1-5 should be green (red means that feature was stripped). The dots under each cell are its number.
      </Text>,
      picture('s4', SCRUB, 'Six test cells'),
      pick('s4', 'Which cells are red?', ['1', '2', '3', '4', '5']),
      ask('s4h', 'Cell 6 (amber) turns blue when you point at it:', ['turns blue', 'stays amber']),
      ask('s4t', 'Pointing at cell 6 shows a little "tooltip works" label:', ['shows', 'nothing']),

      heading('h5', 'Which kinds of movement work?'),
      <Text key="i5" dimColor wrap="wrap">
        Each lane's black square starts in the red zone. Lanes 1-5, 7 and 8 should end in the green zone within 2 seconds and stay there. Lane 6 should blink. The dots count the lane.
      </Text>,
      picture('s5', lanes(d.replay), 'Eight movement lanes'),
      <Box key="s5-replay" flexDirection="row">
        <Button key="replay" label="Play again" onPress={() => act.replay()} />
      </Box>,
      pick('s5', 'Which lanes did NOT end in green (or, for 6, does not blink)?', ['1', '2', '3', '4', '5', '6', '7', '8']),

      heading('h7', 'Do signs line up under the towers?'),
      picture('s7-3', towers(3), 'Three towers'),
      signs(el, 3),
      picture('s7-5', towers(5), 'Five towers'),
      signs(el, 5),
      picture('s7-8', towers(8), 'Eight towers'),
      signs(el, 8),
      ask('s7', 'Each ▲ sits under its tower:', ['lined up', 'a bit off', 'way off']),

      heading('h8', 'Chips and emoji'),
      <Box key="chips" flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text backgroundColor="success" color="inverseText">
          {' receipts ✅ '}
        </Text>
        <Text backgroundColor="claude" color="inverseText">
          {' captain · on it '}
        </Text>
        <Text inverse color="warning">
          {' BUMPY AIR '}
        </Text>
      </Box>,
      <Box key="chip-buttons" flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="chip-in-button" onPress={() => undefined}>
          <Text>Log in with Google </Text>
          <Text backgroundColor="success" color="inverseText">
            {' receipts ✅ '}
          </Text>
        </Button>
        <Button key="emoji-button" label="✈️ Take off now" onPress={() => undefined} />
        <Button key="emoji-button-2" label="🎟 Boarding pass" onPress={() => undefined} />
      </Box>,
      <Text key="emoji">✅ 😬 🎟 ☀ ✈️ 🛫 🛬</Text>,
      ask('s8c', 'The three chips on the first row look like filled pills:', ['pills', 'plain text']),
      ask('s8b', 'The button with the chip inside looks fine:', ['fine', 'broken']),
      ask('s8e', 'All seven emoji show (no empty boxes):', ['all show', 'some missing']),

      heading('h10', 'Hover'),
      <Box key="hover-row" flexDirection="column" hover={{ backgroundColor: 'claude', scope: 'lab-hover' }}>
        <Text>Point at this line</Text>
        <Box key="hover-reveal" display="none" hover={{ display: 'flex', scope: 'lab-hover' }}>
          <Text dimColor>...and this extra line appears</Text>
        </Box>
      </Box>,
      ask('s10', 'Pointing at the line highlights it and shows an extra line:', ['both', 'only highlight', 'nothing']),
    ]
  } else {
    body = [
      heading('h9', 'The busy sky'),
      <Text key="i9" dimColor wrap="wrap">
        This is about as busy as the v2 sky gets. Leave this page showing for a minute: Claude is measuring how much computer power it uses.
      </Text>,
      picture('s9', BUSY, 'A pixel sky with clouds, the plane and three crew'),
      ask('s9', 'It looks smooth (no stutter) and the propeller spins:', ['smooth', 'stutters', 'frozen']),
      ask('s9f', 'Does the computer feel slower or the fan get louder with this open?', ['no', 'a little', 'yes']),
    ]
  }

  return (
    <Box flexDirection="column">
      {top}
      {body}
    </Box>
  )
}

function signs(el: LabElements, n: number): RenderElement {
  const { Box, Text } = el

  return (
    <Box key={`signs-${n}`} flexDirection="row" width="100%">
      {Array.from({ length: n }, (_, i) => (
        <Box key={`sign-${n}-${i}`} width={0} flexGrow={1} alignItems="center" justifyContent="center">
          <Text wrap="truncate-end">▲</Text>
        </Box>
      ))}
    </Box>
  )
}

// The pictures, for tests: sizes must stay inside the engine's bound.
export const LAB_SOURCES = { ruler: ruler(BANNER), SWEEP, plane: planeSvg(true), THEME, SCRUB, lanes: lanes(0), towers: towers(8), BUSY }
