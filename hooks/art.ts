import type { Grid, Palette } from './pixels'
import type { SkyBucket } from './scene'

// The pixel art of the sky, as plain data: every sprite is rows of palette
// characters ('.' is clear), drawn by pixels.ts. Grids come from the v2 design
// (§1 sprites); palettes from §1 palette. Nothing here draws or decides.

// ---------------------------------------------------------------- colors

export const INK = '#2B1D16'
export const CREAM = '#FFF4E0'
export const ORANGE = '#D97757'
export const ORANGE_SHADE = '#B5563A'
export const GLASS = '#9ED8F0'
export const WHITE = '#FFFFFF'
export const GREEN = '#2E9E5B'
export const MINT = '#7FD39B'
export const AMBER = '#F2A93B'
export const RED = '#D64545'
export const GOLD = '#F2B13C'
export const NAVY = '#23395B'
export const SKIN = '#E9B48A'
export const GREY = '#8C8A93'
export const LIGHT = '#C9C2B8'
export const LILAC = '#A78BFA'
export const ASPHALT = '#55555F'
export const PAINT = '#F4F1EA'
export const LAMP = '#FFD54F'
export const RAIN = '#9FB4D9'
export const STORM = '#4B5563'
export const STORM_SHADE = '#374151'
export const DUSK_INK = '#1B1B22'
export const CONFETTI_COLORS = ['#D97757', '#2E9E5B', '#F2B13C', '#4FA3E3', '#E85D9E'] as const

// The base palette most sprites share; a sprite with its own slots passes
// its own palette (clouds, crew, the sun).
export const BASE: Palette = {
  K: INK,
  O: ORANGE,
  o: ORANGE_SHADE,
  C: CREAM,
  W: GLASS,
  w: WHITE,
  F: WHITE,
  N: NAVY,
  S: SKIN,
  Y: GOLD,
  G: GREEN,
  g: MINT,
  A: AMBER,
  R: RED,
  M: GREY,
  L: LIGHT,
  p: '#8C7F75',
  r: '#C2603F',
}

// ---------------------------------------------------------------- the sky by time of day

// Four bands top to horizon, cloud and its shade, ground and hills, the sun.
export type Sky = { bands: readonly [string, string, string, string]; cloud: string; shade: string; ground: string; hills: string; sun: string }

export const SKIES: Record<SkyBucket, Sky> = {
  predawn: { bands: ['#1E2A55', '#3B3F7A', '#7A5A8C', '#E59A7A'], cloud: '#C9B6D6', shade: '#9C86B5', ground: '#33463A', hills: '#2A3A30', sun: '#FFB27A' },
  dawn: { bands: ['#3E5BA9', '#7C7FC0', '#F3A98B', '#FFD29A'], cloud: '#FFE9E0', shade: '#E8B7B0', ground: '#4E7A4B', hills: '#3F6740', sun: '#FFB347' },
  morning: { bands: ['#4FA3E3', '#7CC0EE', '#A9D8F5', '#D9F0FB'], cloud: '#FFFFFF', shade: '#D6E8F5', ground: '#6DBE6A', hills: '#57A457', sun: '#FFD54F' },
  noon: { bands: ['#2F8FE0', '#56A9EC', '#86C5F3', '#C3E5FA'], cloud: '#FFFFFF', shade: '#CFE3F3', ground: '#66B85A', hills: '#4F9C49', sun: '#FFF07A' },
  afternoon: { bands: ['#3D86D1', '#6AA6DE', '#A7C9E8', '#F2E3C2'], cloud: '#FFFDF5', shade: '#E6DCC8', ground: '#79B35A', hills: '#62994A', sun: '#FFC94A' },
  golden: { bands: ['#4A6FB8', '#E39B6B', '#F7B267', '#FFD9A0'], cloud: '#FFE3C2', shade: '#E9A47A', ground: '#8A9A4E', hills: '#6F7F3E', sun: '#FF9F3F' },
  dusk: { bands: ['#2E3A75', '#7B4B8E', '#E46F6A', '#F8A65B'], cloud: '#F6B6A8', shade: '#B9768A', ground: '#3F5A44', hills: '#314836', sun: '#FF7A3D' },
}

// ---------------------------------------------------------------- the plane (Claude orange, nose right)

// 26x13. The cockpit window is at x 17-19, rows 5-6.
export const PLANE: Grid = [
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

// The captain at the controls: navy cap over a face, in the window.
export const PILOT: Grid = ['NN', 'SS']
export const PILOT_AT = [18, 5] as const

// The propeller column at x 25, rows 2-12 (row 7 is the hub, in the body).
export const PROP_FULL: Grid = ['K', 'K', 'K', 'K', 'K', '.', 'K', 'K', 'K', 'K', 'K']
export const PROP_EDGE: Grid = ['.', '.', '.', 'K', 'K', '.', 'K', 'K', '.', '.', '.']
export const PROP_BLUR: Grid = ['p', 'p', 'p', 'p', 'p', '.', 'p', 'p', 'p', 'p', 'p']
export const PROP_AT = [25, 2] as const

// Landing gear, rows 11-14 of the plane: nose wheel and main wheel.
export const GEAR: Grid = [
  '....................K.....',
  '....................K.....',
  '............K.......K.....',
  '...........KMK.....KMK....',
]
export const GEAR_AT = 11

// Contrail puffs behind the tail (x -12 from the plane, rows 7-8).
export const PUFFS: Grid = ['.CC......CC', '.....CC....']
export const PUFFS_AT = [-12, 7] as const

// A red beacon on the tail fin (parked and paused).
export const TAIL_LIGHT = [2, 0] as const

// ---------------------------------------------------------------- the captain (Claude) and the crew

// 10x14, feet on the bottom row. The O on the cap is the Claude badge.
export const CAPTAIN: Grid = [
  '...NNNN...',
  '..NNONNN..',
  '.KKKKKKKK.',
  '...SSSS...',
  '...SKSK...',
  '...SSSS...',
  '..NNFFNN..',
  '.NNNFYNNN.',
  'SNNNFFNNNS',
  '.NNNNNNNN.',
  '..NNNNNN..',
  '..NN..NN..',
  '..NN..NN..',
  '.KKK..KKK.',
]

export const CAPTAIN_WAVE: Grid = [
  '...NNNN..S',
  '..NNONNN.S',
  '.KKKKKKKKN',
  '...SSSS..N',
  '...SKSK.NN',
  '...SSSS.N.',
  '..NNFFNNN.',
  '.NNNFYNNN.',
  'SNNNFFNNN.',
  '.NNNNNNNN.',
  '..NNNNNN..',
  '..NN..NN..',
  '..NN..NN..',
  '.KKK..KKK.',
]

// Props in the captain's right hand (x 9, row 8 is the hand).
export const MUG: Grid = ['FFK', 'FFK', 'FF.']
export const MUG_AT = [9, 6] as const
export const STEAM: Grid = ['.L', 'L.']
export const STEAM_AT = [9, 3] as const
export const CLIPBOARD: Grid = ['.KMK', 'KCCC', 'KCKC', 'KCCC', 'KCCC']
export const CLIPBOARD_AT = [8, 5] as const

// Crew, 8x13, three frames recolored per outfit (h hat, t top, b bottom, s skin).
export const CREW_STAND: Grid = [
  '........',
  '..hhhh..',
  '.hhhhhhh',
  '..ssss..',
  '..sKsK..',
  '..ssss..',
  '.tttttt.',
  'stttttts',
  '.tttttt.',
  '..bbbb..',
  '..b..b..',
  '..b..b..',
  '.KK..KK.',
]

export const CREW_WALK: Grid = [
  '........',
  '..hhhh..',
  '.hhhhhhh',
  '..ssss..',
  '..sKsK..',
  '..ssss..',
  '.tttttt.',
  '.ttttttt',
  '.stttts.',
  '..bbbb..',
  '.bb..bb.',
  '.b....b.',
  'KK....KK',
]

export const CREW_CHEER: Grid = [
  's......s',
  't.hhhh.t',
  'thhhhhht',
  't.ssss.t',
  't.sKsK.t',
  't.sKKs.t',
  '.tttttt.',
  '.tttttt.',
  '.tttttt.',
  '..bbbb..',
  '.bb..bb.',
  '.K....K.',
  '........',
]

// Outfits by dispatch order mod 3: ramp crew, cabin crew, mechanic. No names.
// `extra` is a small overlay in the outfit's own detail color.
export const OUTFITS: readonly { palette: Palette; extra: Grid; extraAt: readonly [number, number] }[] = [
  { palette: { h: '#F7D046', t: '#FF8A1F', b: '#3E4A5C', s: '#F2C29B', K: INK, x: CREAM }, extra: ['x..x'], extraAt: [2, 7] },
  { palette: { h: '#2F8F8A', t: '#2F8F8A', b: '#23395B', s: '#C68A5E', K: INK, x: GOLD }, extra: ['xx'], extraAt: [3, 6] },
  { palette: { h: '#3E6FB0', t: '#3E6FB0', b: '#2B3A55', s: '#8D5A3B', K: INK, x: GREY }, extra: ['x', 'x'], extraAt: [7, 5] },
]

// More crew than the three drawn: a small "+".
export const PLUS: Grid = ['.KKK.', 'KKCKK', 'KCCCK', 'KKCKK', '.KKK.']

// ---------------------------------------------------------------- clouds and weather

// Clouds: F is the cloud, c its shade (by time of day).
export const CLOUD_BIG: Grid = [
  '.....FFFF.......',
  '...FFFFFFFF.FF..',
  '..FFFFFFFFFFFFF.',
  'FFFFFFFFFFFFFFFF',
  'cccccccccccccccc',
  '.cccccccccccccc.',
]

export const CLOUD_SMALL: Grid = ['...FFF....', '.FFFFFFFF.', 'FFFFFFFFFF', '.cccccccc.']

export const STORM_CLOUD: Grid = [
  '......XXXX..........',
  '...XXXXXXXXX.XXX....',
  '..XXXXXXXXXXXXXXXX..',
  'XXXXXXXXXXXXXXXXXXXX',
  'xxxxxxxxxxxxxxxxxxxx',
  '.xxxxxxxxxxxxxxxxxx.',
]
export const STORM_PALETTE: Palette = { X: STORM, x: STORM_SHADE }

export const BOLT: Grid = ['..YYY', '.YYY.', '.YY..', 'YYYYY', '..YF.', '.YY..', '.Y...', 'Y....']
export const BOLT_PALETTE: Palette = { Y: '#FFE45C', F: WHITE }

// ---------------------------------------------------------------- stops on the route

// A map pin, 7x9, tip at (3, 8). C is the body, d the center dot.
export const PIN: Grid = ['..KKK..', '.KCCCK.', 'KCCCCCK', 'KCCdCCK', 'KCCCCCK', '.KCCCK.', '..KCK..', '...K...', '...K...']
// Proposed by you, not planned yet: a dashed stem.
export const PIN_YOURS: Grid = ['..KKK..', '.KCCCK.', 'KCCCCCK', 'KCCdCCK', 'KCCCCCK', '.KCCCK.', '..KCK..', '.......', '...K...']
export const PIN_TIP = 3

export const PIN_PENDING: Palette = { K: INK, C: CREAM, d: INK }
// The pin the plane is flying to; scene.ts blinks a white heart and a red
// beacon on it.
export const PIN_CURRENT: Palette = { K: INK, C: ORANGE, d: ORANGE }
export const PIN_PROPOSED: Palette = { K: INK, C: LILAC, d: INK }

// Done, not tested: an ink check on mint (white on mint cannot be read).
export const PIN_DONE: Grid = ['..KKK..', '.KgggK.', 'KggggKK', 'KgggKgK', 'KKgKggK', '.KKggK.', '..KgK..', '...K...', '...K...']
// A step in it failed: amber "!".
export const PIN_FAILED: Grid = ['..KKK..', '.KAAAK.', 'KAAKAAK', 'KAAKAAK', 'KAAAAAK', '.KAKAK.', '..KAK..', '...K...', '...K...']

// Every step has receipts: a green flag with a white check, pole tip at (1, 8).
export const FLAG: Grid = [
  '.Y......',
  '.KKKKKKK',
  '.KGGGGFK',
  '.KGGGFGK',
  '.KFGFGGK',
  '.KGFGGGK',
  '.KKKKKKK',
  '.K......',
  '.K......',
]
export const FLAG_TIP = 1
export const SPARKLE: Grid = ['.Y.', 'YFY', '.Y.']

// Mini pins for very narrow skies (5x7, tip at (2, 6)).
export const MINI_PIN: Grid = ['.KKK.', 'KCdCK', 'KCCCK', '.KCK.', '..K..', '..K..', '..K..']
export const MINI_DONE: Grid = ['.KKK.', 'KgggK', 'KgggK', '.KgK.', '..K..', '..K..', '..K..']
export const MINI_FAILED: Grid = ['.KKK.', 'KAKAK', 'KAAAK', '.KAK.', '..K..', '..K..', '..K..']
export const MINI_FLAG: Grid = ['.KKKK', '.KGGK', '.KGGK', '.KKKK', '.K...', '.K...', '.K...']
export const MINI_TIP = 2

// No route yet: a signpost with a "?" (tip at (4, 11)).
export const SIGNPOST: Grid = [
  '.KKKKKKK.',
  'KCCKKKCCK',
  'KCKCCCKCK',
  'KCCCCKCCK',
  'KCCCKCCCK',
  'KCCCCCCCK',
  'KCCCKCCCK',
  '.KKKKKKK.',
  '....K....',
  '....K....',
  '....K....',
  '...KKK...',
]

// The receipts stamp: a green badge with a check, 9x9.
export const BADGE: Grid = [
  '..KKKKK..',
  '.KGGGGGK.',
  'KGGGGGFGK',
  'KGGGGFGGK',
  'KGFGFGGGK',
  'KGGFGGGGK',
  'KGGGGGGGK',
  '.KGGGGGK.',
  '..KKKKK..',
]

// Your turn: a "?" bubble, 9x10, tail bottom-left toward the plane.
export const QUESTION: Grid = [
  '.KKKKKKK.',
  'KCCKKKCCK',
  'KCKCCCKCK',
  'KCCCCCKCK',
  'KCCCKKCCK',
  'KCCCKCCCK',
  'KCCCCCCCK',
  'KCCCKCCCK',
  '.KKKKKKK.',
  '.KK......',
]

// The captain's question at the gate, 5x7: a cream "?" in ink, small
// enough to sit between the pins and the cap.
export const QUESTION_SMALL: Grid = ['.KKK.', 'KCCCK', 'KKKCK', '.KCCK', '.KCK.', '.KKK.', '.KCK.']

// Paused: two bars.
export const PAUSE: Grid = ['KKK.KKK', 'KCK.KCK', 'KCK.KCK', 'KCK.KCK', 'KCK.KCK', 'KCK.KCK', 'KKK.KKK']

// Landed with failing tests: an amber warning triangle on a post, 9x13.
export const WARNING: Grid = [
  '....K....',
  '...KAK...',
  '..KAKAK..',
  '..KAKAK..',
  '.KAAKAAK.',
  '.KAAAAAK.',
  'KAAAKAAAK',
  'KKKKKKKKK',
  '....K....',
  '....K....',
  '....K....',
  '....K....',
  '...KKK...',
]

// ---------------------------------------------------------------- the airfield

// Control tower, 9x17, beacon above (4, -1). C is tower cream.
export const TOWER: Grid = [
  '...KKK...',
  '..KWWWK..',
  '.KWWwWWK.',
  'KKKKKKKKK',
  '.KCCCCCK.',
  '..KCCCK..',
  '..KCMCK..',
  '..KCCCK..',
  '..KCCCK..',
  '..KCMCK..',
  '..KCCCK..',
  '..KCCCK..',
  '..KCMCK..',
  '..KCCCK..',
  '..KCCCK..',
  '.KCCCCCK.',
  'KKKKKKKKK',
]
export const TOWER_PALETTE: Palette = { ...BASE, C: '#EFE6D2' }

// Jet bridge from the terminal to the plane's door, 12x5.
export const BRIDGE: Grid = ['KKKKKKKKKKKK', 'KLLLLLLLLLLK', 'KLWLLWLLWLLK', 'KLLLLLLLLLLK', 'KKKKKKKKKKKK']

// The sun: body plus two ray sets that swap.
export const SUN_BODY: Grid = ['.........', '.........', '...YYY...', '..YYYYY..', '..YYYYY..', '..YYYYY..', '...YYY...', '.........', '.........']
export const SUN_RAYS_A: Grid = ['....Y....', '.........', '.........', '.........', 'Y.......Y', '.........', '.........', '.........', '....Y....']
export const SUN_RAYS_B: Grid = ['.........', '.Y.....Y.', '.........', '.........', '.........', '.........', '.........', '.Y.....Y.', '.........']

// ---------------------------------------------------------------- terminal and band glyphs

// Kept from v1's sprites.ts: the terminal and the band draw no Svg, one
// glyph per pose.
export type Pose = 'flying' | 'cruise' | 'thinking' | 'holding' | 'turbulence' | 'celebrate' | 'parked' | 'landed'

export const GLYPHS: Record<Pose, string> = {
  flying: '✈',
  cruise: '✈',
  thinking: '✈…',
  holding: '✈?',
  turbulence: '✈!',
  celebrate: '✈*',
  parked: '✈',
  landed: '⚑',
}
