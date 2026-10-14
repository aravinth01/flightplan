import { describe, expect, test } from 'claude-code/testing'

import { newRoute } from '../hooks/model'
import { NOUN_STOP, WORDS, activityFor, clockWord, glyphs, gloss, landingWords, say } from '../hooks/text'
import type { Voice, WordKey } from '../hooks/text'
import type { Route, Step } from '../types'

const KEYS = Object.keys(WORDS) as WordKey[]
const VOICES: Voice[] = ['fun', 'plain']
const POSES = ['empty', 'ground', 'boarding', 'air', 'ask', 'holding', 'paused', 'chop', 'storm', 'landed']

// The three emoji the fun voice may use, and the text marks both voices may
// draw (✈ and ☀ without the emoji selector are glyphs, not emoji).
const EMOJI = /\p{Extended_Pictographic}️?/gu
const ALLOWED = ['✈️', '✅', '🎟️']
const MARKS = ['✈', '☀']
const emojiOf = (text: string) => [...text.matchAll(EMOJI)].map(match => match[0]).filter(one => !MARKS.includes(one))

const slotsOf = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]!))].sort()
const isTag = (key: string) => /\.tag(\.|$)/.test(key)
const isButton = (key: string) => key.startsWith('btn.')
const isAlt = (key: string) => key.startsWith('alt.')
const isChip = (key: string) => key.includes('.chip.')
const text = (key: WordKey, voice: Voice) => WORDS[key][voice]

// Every key whose string matches, so a failure names the offenders.
function offenders(match: (line: string, key: WordKey, voice: Voice) => boolean): string[] {
  return KEYS.flatMap(key => VOICES.filter(voice => match(text(key, voice), key, voice)).map(voice => `${key} (${voice})`))
}

// "receipts" means a test run the map saw pass; "no receipts yet" and "need
// receipts" say a step has none. Nothing else may use the word.
const RECEIPTS: string[] = [
  'card.landed.headline.allChecked',
  'card.landed.headline.allCheckedYours',
  'step.chip.checked',
  'stop.chip.checked',
  'stop.chip.checkedYours',
  'captain.chip.receipts',
  'scene.phrase.receipts',
  'pass.route',
  'toast.receipts',
  'toast.stopVerified',
  'toast.landed.allChecked',
  'toast.landed.allCheckedYours',
  'legend.checked',
]
const NO_RECEIPTS: string[] = [
  'card.landed.headline.untested',
  'card.landed.headline.yours',
  'card.landed.untested',
  'step.chip.done',
  'stop.chip.untested',
  'scene.phrase.landedUntested',
  'toast.landed.untested',
  'legend.untested',
]
const PARTY: string[] = [
  'card.landed.tag.party',
  'card.landed.headline.allChecked',
  'card.landed.headline.allCheckedYours',
  'toast.landed.allChecked',
  'toast.landed.allCheckedYours',
  'scene.phrase.landedAll',
  'band.landed.party',
]
const PAUSED: string[] = ['card.paused.tag', 'captain.chip.paused', 'scene.phrase.paused']

const BANNED = [
  /\bngl\b/i, /\bfr\b/i, /\btbh\b/i, /\bidk\b/i, /\brn\b/i, /\bimo\b/i, /\bgoat\b/i, /\bpov\b/i,
  /\bslay/i, /\bno cap\b/i, /\bbussin/i, /\brizz/i, /\bperiodt\b/i, /\bsheesh\b/i, /\bbestie\b/i, /\byeet/i,
  /\bit'?s giving\b/i, /\bdelulu\b/i, /\bmid\b/i, /\bbased\b/i, /\bsus\b/i, /\baura\b/i, /\bcooked\b/i,
  /\blowkey\b/i, /\bhighkey\b/i, /\bmain character\b/i, /\bunderstood the assignment\b/i, /\bvibe check\b/i,
  /\bnailed it\b/i, /\bcrushing it\b/i, /\bperfect/i, /\bflawless/i, /\beasy\b/i, /\bquick/i,
  /\balmost done\b/i, /\bnearly there\b/i, /\bshould work\b/i, /\blol\b/i, /\boops\b/i,
  /\beta\b/i, /%/, /\bpercent/i, /\bminutes? (left|to go)\b/i,
]
// The fun voice's whole flavor list; plain uses none of it.
const SLANG = [/receipts/i, /\bwe ate\b/i, /not gonna lie/i, /\bnope\b/i, /\byour move\b/i, /\bhold up\b/i, /\bhit\b/i, /\btweak/i, /\btake a look\b/i, /\bcut\b/i, /\bcatch up\b/i, /taking five/i]

function step(id: string, status: Step['status'], doneBy?: Step['doneBy']): Step {
  return { id, featureId: 'f1', title: `Step ${id}`, why: '', files: [], check: '', status, written: [], ...(doneBy !== undefined ? { doneBy } : {}) }
}

function landed(steps: Step[], failed = 0): Route {
  const route = newRoute(0)
  route.features = [{ id: 'f1', title: 'Log in', why: '' }]
  route.steps = steps
  route.landedAt = 1
  route.tests = { passed: 4, failed, at: 1, command: 'npm test' }
  return route
}

describe('the deck', () => {
  test('every key has both voices, and neither is empty', () => {
    expect(KEYS.length).toBeGreaterThan(100)
    expect(offenders(line => typeof line !== 'string' || line.trim() === '')).toEqual([])
  })

  test('both voices carry the same slots, so they state the same facts', () => {
    const facts = (line: string) => slotsOf(line).filter(name => name !== 's' && name !== 'is').join()
    expect(KEYS.filter(key => facts(text(key, 'fun')) !== facts(text(key, 'plain')))).toEqual([])
  })

  test('say fills every slot and leaves no brace behind', () => {
    const left = KEYS.flatMap(key =>
      VOICES.flatMap(voice => {
        const vars = Object.fromEntries(slotsOf(text(key, voice)).map(name => [name, 2]))
        const line = say(key, voice, vars)
        return /[{}]/.test(line) ? [`${key} (${voice}): ${line}`] : []
      }),
    )
    expect(left).toEqual([])
  })

  test('{s} follows the nearest number before it, and a missing value stays visible', () => {
    expect(say('card.ready.summary', 'plain', { total: 1, stops: 2, clock: 'on hold' })).toBe(`1 step in 2 ${NOUN_STOP}s · on hold`)
    expect(say('card.ready.summary', 'fun', { total: 9, stops: 1, clock: 'wheels up in 24s' })).toBe(`9 steps, 1 ${NOUN_STOP} · wheels up in 24s`)
    expect(say('card.holding.toGo', 'plain', { n: 1 })).toBe('1 step to go')
    expect(say('card.holding.toGo', 'plain', {})).toBe('{n} steps to go')
    expect(say('card.ask.summary', 'plain', { question: 'Keep {it}?' })).toBe('Claude asks: Keep {it}?')
  })

  test('the stop is the one noun the person sees', () => {
    expect(NOUN_STOP).toBe('stop')
    expect(say('btn.addStop', 'fun')).toBe('Add a stop')
    expect(say('pass.header', 'plain', { i: 2, n: 4 })).toBe('stop 2 of 4 · BOARDING PASS')
    expect(offenders(line => /\b(feature|waypoint)s?\b/i.test(line))).toEqual([])
  })

  test('nothing Claude reads lives here: no prompts, no "Go:" line', () => {
    expect(KEYS.filter(key => key.startsWith('prompt.'))).toEqual([])
    expect(offenders(line => /^Go:/.test(line))).toEqual([])
  })
})

describe('emoji', () => {
  test('plain draws none; fun draws only ✈️ ✅ 🎟️, at most one a line', () => {
    expect(offenders((line, _key, voice) => voice === 'plain' && emojiOf(line).length > 0)).toEqual([])
    expect(offenders(line => emojiOf(line).some(one => !ALLOWED.includes(one)))).toEqual([])
    expect(offenders(line => emojiOf(line).length > 1)).toEqual([])
  })

  test('none in a tag, a button or alt text', () => {
    expect(offenders((line, key) => (isTag(key) || isButton(key) || isAlt(key)) && emojiOf(line).length > 0)).toEqual([])
  })

  test('✈️ and 🎟️ sit at a line edge, so the terminal can drop them cleanly', () => {
    expect(offenders(line => /(?:✈️|🎟️)/u.test(line) && !/^(?:✈️|🎟️) |\s(?:✈️|🎟️)$/u.test(line))).toEqual([])
  })

  test('the terminal swaps ✅ for ✓ and drops the others', () => {
    for (const voice of VOICES) {
      const marks = glyphs('terminal', voice)
      expect(emojiOf(Object.values(marks).join(''))).toEqual([])
      expect(marks).toEqual({ check: '✓', plane: '✈', ticket: '' })
    }
    expect(glyphs('desktop', 'fun')).toEqual({ check: '✅', plane: '✈️', ticket: '🎟️' })
    expect(emojiOf(Object.values(glyphs('desktop', 'plain')).join(''))).toEqual([])

    const left = KEYS.filter(key => {
      const vars = Object.fromEntries(slotsOf(text(key, 'fun')).map(name => [name, 2]))
      return emojiOf(say(key, 'fun', vars, 'terminal')).length > 0
    })
    expect(left).toEqual([])
    expect(say('step.chip.checked', 'fun', {}, 'terminal')).toBe('receipts ✓')
    expect(say('pass.header', 'fun', { i: 2, n: 4 }, 'terminal')).toBe('stop 2 of 4 · BOARDING PASS')
    expect(say('toast.landed.allCheckedYours', 'fun', { checked: 3, yours: 1 }, 'terminal')).toBe('Touchdown, we ate. Receipts on 3 steps; you checked or skipped 1')
  })
})

describe('honesty', () => {
  test('"receipts" only where a seen test passed, or to say there are none yet', () => {
    expect(offenders((line, key) => /receipts/i.test(line) && !RECEIPTS.includes(key) && !NO_RECEIPTS.includes(key))).toEqual([])
    const negative = offenders((line, key) => NO_RECEIPTS.includes(key) && /receipts/i.test(line.replace(/\b(no|needs?) receipts/gi, '')))
    expect(negative).toEqual([])
    expect(offenders((line, key) => NO_RECEIPTS.includes(key) && /✅/.test(line))).toEqual([])
  })

  test('"we ate" and TOUCHDOWN only on a party landing', () => {
    expect(offenders((line, key) => /\bwe ate\b/i.test(line) && !PARTY.includes(key))).toEqual([])
    expect(offenders((line, key) => /\btouchdown\b/i.test(line) && !PARTY.includes(key))).toEqual([])
    expect(offenders(line => /\bate\b/i.test(line.replace(/\bwe ate\b/gi, '')))).toEqual([])
  })

  test('each flavor word stays in its lane', () => {
    expect(offenders((line, key) => /not gonna lie/i.test(line) && key !== 'card.turbulence.hint')).toEqual([])
    expect(offenders(line => /\bnope\b/i.test(line.replace(/tests say nope/g, '')))).toEqual([])
    expect(offenders((line, key) => /taking five/i.test(line) && !PAUSED.includes(key))).toEqual([])
    expect(offenders((line, key) => /✅/.test(line) && key.startsWith('crew.'))).toEqual([])
    expect(offenders(line => /✅/.test(line) && /\byou\b/i.test(line))).toEqual([])
  })

  test('no banned slang, no overclaims, no ETA and no percentage', () => {
    expect(offenders(line => BANNED.some(pattern => pattern.test(line)))).toEqual([])
    expect(offenders(line => (line.match(/!/g) ?? []).length > 1)).toEqual([])
  })

  test('plain uses none of the fun voice\'s flavor', () => {
    expect(offenders((line, _key, voice) => voice === 'plain' && SLANG.some(pattern => pattern.test(line)))).toEqual([])
  })
})

describe('shapes', () => {
  test('chips are 30 characters or fewer', () => {
    expect(offenders((line, key) => isChip(key) && line.length > 30)).toEqual([])
  })

  test('card tags are UPPERCASE and short', () => {
    expect(offenders((line, key) => isTag(key) && (line !== line.toUpperCase() || line.length > 17))).toEqual([])
  })

  test('buttons are the same plain verbs in both voices', () => {
    expect(KEYS.filter(key => isButton(key) && text(key, 'fun') !== text(key, 'plain'))).toEqual([])
  })

  test('clock phrases fit in 22 characters, pin signs in 8', () => {
    expect(offenders((line, key) => key.startsWith('scene.phrase.') && line.length > 22)).toEqual([])
    expect(offenders((line, key) => key.startsWith('pin.') && say(key, 'plain', { i: 8 }).length > 8)).toEqual([])
  })

  test('voiced hints and toasts are one short sentence', () => {
    const voiced = KEYS.filter(key => (key.includes('hint') || key.startsWith('toast.')) && text(key, 'fun') !== text(key, 'plain'))
    expect(voiced.length).toBeGreaterThan(8)
    expect(voiced.flatMap(key => VOICES.filter(voice => text(key, voice).length > 90).map(voice => `${key} (${voice})`))).toEqual([])
  })
})

describe('the sky clock', () => {
  test('every scene pose has words in both voices', () => {
    for (const pose of POSES) for (const voice of VOICES) expect(clockWord(pose, voice).length).toBeGreaterThan(0)
    expect(clockWord('air', 'fun')).toBe('cruising')
    expect(clockWord('boarding', 'fun')).toBe('now boarding')
    expect(clockWord('ask', 'fun')).toBe('your turn')
    expect(clockWord('ask', 'plain')).toBe('your turn to answer')
  })

  test('weather words follow the card: chop is a wobble, storm is bumpy air', () => {
    expect(clockWord('storm', 'fun')).toBe('bumpy air')
    expect(clockWord('storm', 'plain')).toBe('having trouble')
    for (const voice of VOICES) expect(clockWord('chop', voice, { done: 3, total: 9 })).toBe(clockWord('air', voice, { done: 3, total: 9 }))
    expect(clockWord('chop', 'fun')).not.toBe('bumpy air')
  })

  test('the phrase reads counts of steps, never time', () => {
    expect(clockWord('air', 'fun', { done: 0, total: 9 })).toBe('wheels up')
    expect(clockWord('air', 'fun', { done: 2, total: 9 })).toBe('climbing')
    expect(clockWord('air', 'fun', { done: 4, total: 9 })).toBe('cruising')
    expect(clockWord('air', 'fun', { done: 7, total: 9 })).toBe('on approach')
    expect(clockWord('air', 'plain', { done: 7, total: 9 })).toBe('last steps')
    expect(clockWord('air', 'fun', { done: 4, total: 9, moment: 'receipts' })).toBe('receipts ✅')
    expect(clockWord('air', 'fun', { done: 4, total: 9, moment: 'receipts', surface: 'terminal' })).toBe('receipts ✓')
    expect(clockWord('ground', 'plain', { gate: 'held' })).toBe('on hold')
    expect(clockWord('ground', 'plain', { gate: 'waiting' })).toBe('waiting for Take off')
  })

  test('a landing says "we ate" only when it was a party', () => {
    expect(clockWord('landed', 'fun')).toBe('landed')
    expect(clockWord('landed', 'fun', { landing: 'party' })).toBe('touchdown, we ate')
    expect(clockWord('landed', 'fun', { landing: 'quiet' })).toBe('landed, needs receipts')
    expect(clockWord('landed', 'fun', { landing: 'amber' })).toBe('landed, tests failing')
  })
})

describe('landing words', () => {
  test('party: every step has receipts, so TOUCHDOWN and we ate', () => {
    const words = landingWords(landed([step('s1', 'checked', 'seen'), step('s2', 'checked', 'claude')]), 'fun')
    expect(words).toEqual({
      tag: 'TOUCHDOWN',
      headline: 'Touchdown, we ate. Every step has receipts ✅',
      toast: 'Touchdown, we ate. Every step is done, with receipts ✅',
      phrase: 'touchdown, we ate',
    })
    expect(landingWords(landed([step('s1', 'checked', 'seen')]), 'plain').tag).toBe('LANDED')
  })

  test('party with your sign-offs counts them, and draws no ✅', () => {
    const route = landed([step('s1', 'checked', 'seen'), step('s2', 'checked', 'you'), step('s3', 'skipped', 'you')])
    const words = landingWords(route, 'fun')
    expect(words.headline).toBe('Touchdown, we ate. Receipts on 1 step; you checked or skipped 2.')
    expect(words.headline).not.toContain('✅')
    expect(landingWords(route, 'plain').headline).toBe('Landed. Tests checked 1 step; you checked or skipped 2.')
  })

  test('quiet: LANDED, names the untested steps, never celebrates', () => {
    for (const route of [
      landed([step('s1', 'checked', 'seen'), step('s2', 'done', 'claude'), step('s3', 'done', 'seen')]),
      landed([step('s1', 'checked', 'seen'), step('s2', 'skipped', 'claude')]),
      landed([step('s1', 'checked', 'you')]),
    ]) {
      for (const voice of VOICES) {
        const words = landingWords(route, voice)
        expect(words.tag).toBe('LANDED')
        expect(JSON.stringify(words)).not.toMatch(/we ate|touchdown|✅/i)
      }
    }
    expect(landingWords(landed([step('s1', 'checked', 'seen'), step('s2', 'done'), step('s3', 'done')]), 'fun').headline).toBe('Landed. No receipts yet on 2 steps.')
    expect(landingWords(landed([step('s1', 'checked', 'seen'), step('s2', 'skipped', 'claude')]), 'plain').headline).toBe('Landed. Claude skipped 1 step.')
    expect(landingWords(landed([step('s1', 'checked', 'you')]), 'plain').headline).toBe('Landed. You checked or skipped 1 step; no test checked them.')
  })

  test('amber: names the failing count in both voices', () => {
    const route = landed([step('s1', 'checked', 'seen'), step('s2', 'checked', 'seen')], 2)
    for (const voice of VOICES) {
      const words = landingWords(route, voice)
      expect(words.tag).toBe('LANDED')
      expect(words.headline).toBe('Landed, but 2 tests failed on the last run.')
      expect(words.toast).toBe('Landed, but the last test run had 2 failing.')
      expect(words.phrase).toBe('landed, tests failing')
    }
  })
})

describe("v1's helpers keep working", () => {
  test('gloss and activityFor read as activities, in plain words', () => {
    expect(gloss('npm test')).toBe('running the automatic checks')
    expect(gloss('tsc -p .')).toBe('checking the code for mistakes')
    expect(gloss('make all')).toBe('running a command')
    expect(activityFor('Edit', '/repo/src/todo.js', undefined, undefined)).toBe('editing todo.js')
    expect(activityFor('Bash', undefined, 'npm test', 'Run the unit tests')).toBe('run the unit tests')
    expect(activityFor('mcp__other__thing', undefined, undefined, undefined)).toBe('using thing')
  })
})
