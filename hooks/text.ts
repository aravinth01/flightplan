// Every string the map writes on its own, in one place, in two voices: 'fun'
// (light gen-z on top of plain English, the default) and 'plain' (friendly
// everyday words). Both voices say the same facts, in the same order, with
// the same numbers; switching voice never changes what a line claims.
//
// Hard rules (tests/words.test.ts holds them): "receipts" only ever means a
// test run the map saw pass; "we ate" only on a party landing; nothing claims
// progress that did not happen; counts, never an ETA or a percentage. Emoji:
// only ✈️ ✅ 🎟️, fun voice, desktop, one per line, never in a tag or button.
// Voice never touches what Claude reads (prompts, nudges, tool results): those
// strings live in register.tsx and contract.ts, not here.

import type { Route } from '../types'
import { basename, hasReceipts, isSkippedByYou, landingOf } from './model'

export type Voice = 'fun' | 'plain'

// The person-facing word for what Claude's contract calls a feature (v1 said
// waypoint), in one place so it can flip back.
export const NOUN_STOP = 'stop'

// A line that reads the same in both voices: buttons, details, editors.
const same = (text: string) => ({ fun: text, plain: text })

// {name} slots are filled by say(). {s} is "s" unless the nearest number
// before it is 1; {is} is "is" or "are" by the same rule.
export const WORDS = {
  // ── Cards: tag (UPPERCASE, no emoji), headline, hint ─────────────────────
  'card.empty.tag': same('ON THE GROUND'),
  'card.empty.body': {
    fun: 'No flight plan yet. Ask Claude for anything with a few steps and your route shows up here.',
    plain: 'No flight plan yet. Ask Claude for something with more than one step, and the route appears here.',
  },

  'card.ready.tag': { fun: 'NOW BOARDING', plain: 'READY FOR TAKEOFF' },
  'card.ready.summary': { fun: `{total} step{s}, {stops} ${NOUN_STOP}{s} · {clock}`, plain: `{total} step{s} in {stops} ${NOUN_STOP}{s} · {clock}` },
  'card.ready.clock.countdown': { fun: 'wheels up in {n}s', plain: 'taking off in {n} s' },
  'card.ready.clock.held': { fun: 'holding at the gate', plain: 'on hold' },
  'card.ready.clock.waitGo': { fun: 'waiting on your Take off', plain: 'waiting for Take off' },
  'card.ready.clock.editing': { fun: 'clock paused while you edit ({n}s left)', plain: 'clock paused while you edit ({n} s left)' },
  'card.ready.hint': { fun: 'Click any step to tweak it before we leave the gate.', plain: 'Click any step to change it before Claude starts.' },
  'card.ready.hintHeld': {
    fun: "Clock's stopped. Change whatever you like, then hit Take off now.",
    plain: 'Clock paused. Change anything, then press Take off now.',
  },

  'card.ask.tag': same('YOUR TURN'),
  'card.ask.summary': { fun: 'Claude needs you: {question}', plain: 'Claude asks: {question}' },
  'card.ask.fallback': same('a question'),
  'card.ask.hint': { fun: "Answer in the chat. We'll circle till you do.", plain: 'Answer in the chat; the plane circles until you do.' },

  'card.turbulence.tag': { fun: 'BUMPY AIR', plain: 'TURBULENCE' },
  'card.turbulence.summary': { fun: 'Tests failed {n} time{s} in a row on "{title}"', plain: '{n} test run{s} in a row failed on "{title}"' },
  'card.turbulence.fallbackTitle': same('this step'),
  'card.turbulence.hint': {
    fun: "Not gonna lie, it's bumpy. Claude usually gets there, but you can step in.",
    plain: 'Claude usually gets there, but you can nudge it.',
  },

  'card.holding.tag': { fun: 'HOLDING PATTERN', plain: 'HOLDING' },
  'card.holding.at': same('at "{title}"'),
  'card.holding.toGo': same('{n} step{s} to go'),
  'card.holding.idle': { fun: 'Your move: reply in the chat, or hit Continue.', plain: 'Your turn: reply in the chat, or press Continue.' },
  'card.holding.blocked': { fun: '{n} step{s} stuck. {idle}', plain: '{n} step{s} blocked. {idle}' },
  'card.holding.unclosed': {
    fun: 'Claude stopped, but {n} step{s} still show as open on the map. {idle}',
    plain: 'Claude stopped with {n} step{s} not marked finished on the map. {idle}',
  },

  'card.paused.tag': { fun: 'TAKING FIVE', plain: 'PAUSED' },
  'card.paused.after': { fun: 'after "{title}". Take your time.', plain: 'after "{title}"' },
  'card.paused.hint': { fun: "Hit Continue when you're ready.", plain: 'Press Continue when you are ready.' },

  'card.now.tag': { fun: 'IN THE AIR', plain: 'NOW' },
  'card.now.fallback': { fun: 'getting set up', plain: 'getting started' },
  'card.now.activity': { fun: '✻ {activity} · {ago} ago', plain: '{activity} · {ago} ago' },
  'activity.thinking': { fun: 'thinking it over', plain: 'thinking' },

  // Landed: TOUCHDOWN and "we ate" only on a party landing (landingWords).
  'card.landed.tag': same('LANDED'),
  'card.landed.tag.party': { fun: 'TOUCHDOWN', plain: 'LANDED' },
  'card.landed.headline.allChecked': { fun: 'Touchdown, we ate. Every step has receipts ✅', plain: 'Landed. A test checked every step.' },
  'card.landed.headline.allCheckedYours': {
    fun: 'Touchdown, we ate. Receipts on {checked} step{s}; you checked or skipped {yours}.',
    plain: 'Landed. Tests checked {checked} step{s}; you checked or skipped {yours}.',
  },
  'card.landed.headline.untested': { fun: 'Landed. {n} step{s} still need receipts.', plain: 'Landed. {n} step{s} not tested yet.' },
  'card.landed.headline.yours': {
    fun: 'Landed. You checked or skipped {n} step{s}, no receipts yet.',
    plain: 'Landed. You checked or skipped {n} step{s}; no test checked them.',
  },
  'card.landed.headline.skipped': same('Landed. Claude skipped {n} step{s}.'),
  'card.landed.headline.quiet': same('Landed.'),
  'card.landed.headline.failing': same('Landed, but {n} test{s} failed on the last run.'),
  'card.landed.headline.failedSteps': same('Landed, but the last test failed on {n} step{s}.'),
  'card.landed.summary': same('{total} step{s} · {files} file{s} · {tests} · {min} min'),
  'card.landed.tests.none': same('no tests seen'),
  'card.landed.tests.mixed': same('{passed} passing, {failed} failing'),
  'card.landed.tests.pass': { fun: '{passed} test{s} passing ✅', plain: '{passed} test{s} passing' },
  'card.landed.untested': { fun: '{n} done, no receipts yet', plain: '{n} done but not tested' },
  'card.landed.flagged': { fun: '{n} choice{s} worth a look', plain: '{n} choice{s} to review' },
  'card.landed.cost': same("This flight's session cost so far: ${cost}"),

  // ── Step and stop chips (lowercase, ≤ 30 chars) ──────────────────────────
  'step.chip.now': { fun: 'on it', plain: 'now' },
  'step.chip.started': same('started'),
  'step.chip.done': { fun: 'done, no receipts yet', plain: 'done, not tested yet' },
  'step.chip.claudeSays': { fun: "done (Claude's word)", plain: 'done, Claude says' },
  'step.chip.checked': { fun: 'receipts ✅', plain: 'checked' },
  'step.chip.youChecked': { fun: 'you checked it ✓', plain: 'you checked it' },
  'step.chip.failed': { fun: 'done? tests say nope', plain: 'done? last test failed' },
  'step.chip.skipped': same('skipped'),
  'step.chip.youSkipped': same('skipped by you'),
  'step.chip.blocked': { fun: 'stuck', plain: 'blocked' },
  'step.chip.removed': same('removed'),
  'step.chip.claudeDropped': { fun: 'Claude dropped it', plain: 'dropped by Claude' },
  'step.chip.youRemoved': { fun: 'cut by you', plain: 'removed by you' },
  'step.retry': { fun: 'still at it, retry {n}', plain: 'trying again ({n})' },

  'stop.chip.proposed': { fun: 'your idea', plain: 'added by you' },
  'stop.chip.removed': { fun: 'cut by you', plain: 'removed by you' },
  'stop.chip.checked': { fun: 'all receipts ✅', plain: 'checked' },
  // Verified with the person's sign-offs (R6): receipts on some steps, the
  // person checked or skipped the rest. Never "all receipts".
  'stop.chip.checkedYours': { fun: 'receipts + your sign-off', plain: 'tested + your sign-off' },
  'stop.chip.untested':{ fun: 'done, no receipts yet', plain: 'done, not tested yet' },
  'stop.chip.failed': { fun: 'tests say nope', plain: 'a test failed' },
  'stop.chip.position': same('step {pos} of {n}'),
  'stop.chip.count': same('{n} step{s}'),
  'stop.why.proposed': { fun: '(Claude still has to plan this)', plain: '(Claude will plan this)' },

  // ── Captain (Claude) and crew (helpers): no names, crew never get ✅ ─────
  'captain.label': { fun: 'captain', plain: 'Claude' },
  'captain.row': { fun: 'captain · {chip}', plain: 'Claude · {chip}' },
  'captain.chip.empty': { fun: 'waiting for a plan', plain: 'no plan yet' },
  'captain.chip.ready': { fun: 'ready at the gate', plain: 'ready' },
  'captain.chip.cruise': { fun: 'on it', plain: 'working' },
  'captain.chip.thinking': { fun: 'thinking…', plain: 'thinking' },
  'captain.chip.flying': { fun: 'onto the next step', plain: 'starting the next step' },
  'captain.chip.receipts': { fun: 'receipts ✅', plain: 'step checked' },
  'captain.chip.waiting': { fun: 'needs you', plain: 'waiting for you' },
  'captain.chip.bumpy': { fun: 'bumpy air', plain: 'having trouble' },
  'captain.chip.paused': { fun: 'taking five', plain: 'paused' },
  'captain.chip.standby': { fun: 'on standby', plain: 'idle' },
  'captain.chip.landed': { fun: 'touched down', plain: 'landed' },

  'crew.label': { fun: 'crew', plain: 'helper' },
  'crew.row': { fun: 'crew · {chip} · {description}', plain: 'helper · {chip} · {description}' },
  'crew.chip.onIt': { fun: 'on it', plain: 'working' },
  'crew.chip.stillAt': { fun: 'still at it', plain: 'still working' },
  'crew.chip.back': { fun: 'reported back', plain: 'finished' },
  'crew.chip.snag': { fun: 'hit a snag', plain: 'ran into a problem' },
  'crew.header': { fun: 'crew on board: {n}', plain: '{n} helper{s} sent out' },
  'crew.more': { fun: '+{n} more crew', plain: '+{n} more helper{s}' },

  // ── Sky clock: "{time} · {phrase}", phrases ≤ 22 chars (clockWord) ───────
  'scene.clock': same('{time} · {phrase}'),
  'scene.phrase.empty': { fun: 'quiet airport', plain: 'nothing planned yet' },
  'scene.phrase.boarding': { fun: 'now boarding', plain: 'boarding' },
  'scene.phrase.gateHold': { fun: 'holding at the gate', plain: 'on hold' },
  'scene.phrase.waitGo': { fun: 'waiting on you', plain: 'waiting for Take off' },
  'scene.phrase.wheelsUp': { fun: 'wheels up', plain: 'just started' },
  'scene.phrase.climbing': { fun: 'climbing', plain: 'under way' },
  'scene.phrase.cruising': same('cruising'),
  'scene.phrase.approach': { fun: 'on approach', plain: 'last steps' },
  'scene.phrase.thinking': { fun: 'thinking it over', plain: 'thinking' },
  'scene.phrase.nextStep': { fun: 'onto the next one', plain: 'next step' },
  'scene.phrase.receipts': { fun: 'receipts ✅', plain: 'step checked' },
  'scene.phrase.grew': { fun: 'route grew', plain: 'new steps added' },
  'scene.phrase.yourTurn': { fun: 'your turn', plain: 'your turn to answer' },
  'scene.phrase.bumpy': { fun: 'bumpy air', plain: 'having trouble' },
  'scene.phrase.holding': { fun: 'holding pattern', plain: 'waiting for you' },
  'scene.phrase.paused': { fun: 'taking five', plain: 'paused' },
  'scene.phrase.landed': same('landed'),
  'scene.phrase.landedAll': { fun: 'touchdown, we ate', plain: 'landed, all checked' },
  'scene.phrase.landedUntested': { fun: 'landed, needs receipts', plain: 'landed, not all tested' },
  'scene.phrase.landedFailing': same('landed, tests failing'),

  // Pin signs under the sky (≤ 8 chars) and the boarding pass per stop.
  'pin.start': { fun: 'gate', plain: 'start' },
  'pin.end': { fun: 'landing', plain: 'finish' },
  'pin.fallback': same(`${NOUN_STOP} {i}`),
  // The count first: a narrow pass cuts the decoration, never "of N".
  'pass.header': { fun: `🎟️ ${NOUN_STOP} {i} of {n} · BOARDING PASS`, plain: `${NOUN_STOP} {i} of {n} · BOARDING PASS` },
  'pass.route': { fun: 'FROM {from} → TO {to} · {steps} step{s} · {checked} with receipts', plain: 'FROM {from} → TO {to} · {steps} step{s} · {checked} checked' },

  // ── Landing line, toasts, band, legend ───────────────────────────────────
  'route.landing': { fun: 'Landing strip: everything checked', plain: 'Landing: everything checked' },

  'toast.receipts': { fun: 'Receipts for "{title}": a test passed ✅', plain: 'Checked: a test passed for "{title}".' },
  'toast.stopVerified': { fun: '"{title}" passed its tests, receipts in ✅', plain: 'All set: "{title}" passed its tests.' },
  'toast.yourTurn': { fun: 'Your move: Claude has a question for you.', plain: 'Your turn: Claude asked you a question.' },
  'toast.checkedByYou': { fun: 'Marked as checked by you ✓', plain: 'Marked as checked by you.' },
  'toast.landed.allChecked': { fun: 'Touchdown, we ate. Every step is done, with receipts ✅', plain: 'Landed: every step is done and checked by a test.' },
  'toast.landed.allCheckedYours': {
    fun: 'Touchdown, we ate. Receipts on {checked} step{s}; you checked or skipped {yours} ✈️',
    plain: 'Landed: tests checked {checked} step{s}; you checked or skipped {yours}.',
  },
  'toast.landed.untested': { fun: 'Landed. {n} step{s} still need receipts.', plain: 'Landed: {n} step{s} not tested yet.' },
  'toast.landed.failing': same('Landed, but the last test run had {n} failing.'),
  'toast.blockedLeft': { fun: "Everything's done except {n} stuck. Check the map.", plain: 'Every step is done except {n} blocked. See the map.' },

  'band.line': same('Flight Plan  {label}'),
  'band.ready': { fun: 'Now boarding: {n} step{s} · {clock}', plain: 'Route ready: {n} step{s} · {clock}' },
  'band.ask': { fun: 'Your turn: Claude needs you', plain: 'Your turn: Claude asked you something' },
  'band.flying': same('{where} · {title} · {activity}'),
  'band.landed': same('Landed: {done} of {total} done'),
  'band.landed.party': { fun: 'Touchdown, we ate: {done} of {total} done', plain: 'Landed, all checked: {done} of {total} done' },

  // The marks the map draws: a green ✓ for receipts, a dim ✓ for the rest.
  'legend.checked': { fun: '✓  receipts (green): a test the map saw pass', plain: '✓  done and checked (green): a test the map saw pass' },
  'legend.untested': {
    fun: '✓  done, no receipts yet (dim): finished, but no test proved it',
    plain: '✓  done, not tested yet (dim): finished, but no test proved it',
  },
  'legend.now': { fun: "*  happening now; the plane's on it", plain: '*  in progress; the plane sits on the step' },
  'legend.pending': same('o  not started yet'),
  'legend.failed': { fun: '!  done? tests say nope', plain: '!  done? the last test failed' },
  'legend.decision': { fun: '<> a call Claude made without asking you', plain: '<> a choice Claude made without asking you' },
  'legend.edit': { fun: '~  your edit, on its way to Claude', plain: '~  your change, waiting for Claude' },
  'legend.landing': { fun: '⚑  landing strip: everything checked', plain: '⚑  landing: everything checked' },
  'legend.clock': { fun: '☀  sky clock: how far along we are, not the real time', plain: '☀  the clock shows progress, not the real time' },
  'legend.crew': { fun: '   crew: helpers Claude sent off on side jobs', plain: '   helpers: side jobs Claude handed off' },

  // The add card quotes the stop chip, so it follows the voice.
  'add.hint': { fun: 'It shows as "your idea" until Claude plans its steps.', plain: 'It shows as "added by you" until Claude plans its steps.' },

  // ── Shared in both voices: buttons (plain verbs), header, details ────────
  'btn.takeoff': same('Take off now'),
  'btn.hold': same('Hold, let me look'),
  'btn.showQuestion': same('Show me'),
  'btn.nudge': same('Try another way'),
  'btn.skipStuck': same('Skip this step'),
  'btn.continue': same('Continue'),
  'btn.askUpdate': same('Ask Claude to update the map'),
  'btn.sendCount': same('Send {n} change{s} now'),
  'btn.askCheck': same('Ask Claude to check'),
  'btn.review': same('Review'),
  'btn.pause': same('Pause after this step'),
  'btn.pausing': same('Pausing after this step'),
  'btn.addStop': same(`Add a ${NOUN_STOP}`),
  'btn.where': same('Where are we?'),
  'btn.close': same('Close'),
  'btn.details': same('details'),
  'btn.hideDetails': same('hide details'),
  'btn.legend': same('legend'),
  'btn.hideLegend': same('hide legend'),
  'btn.undoSmall': same('undo'),
  'btn.sendNowSmall': same('send now'),
  'btn.undo': same('Undo'),
  'btn.stopNow': same('Stop now'),
  'btn.stopNow.armed': same('Click again to stop'),
  'btn.skipAfter': same('Skip it after this attempt'),
  'btn.redo': same('Redo this'),
  'btn.iChecked': same('I checked it'),
  'btn.skip': same('Skip it'),
  'btn.remove': same('Remove it'),
  'btn.removeStop': same(`Remove this ${NOUN_STOP}`),
  'btn.keep': same('Keep {choice}'),
  'btn.switch': same('Switch to {alternative}'),
  'btn.askWhy': same('Ask Claude why'),
  'btn.askFirst': same('Ask me first next time'),
  'btn.openMap': same('Open map'),
  'btn.bandHold': same('Hold'),

  'header.where.landed': same('landed'),
  'header.where.ready': same('ready for takeoff'),
  'header.where.step': same('step {n} of {total}'),
  'header.where.count': same('{done} of {total} done'),
  'header.bar': same('{done} done · ~{left} left'),
  'header.grew': same(' +{n} new'),
  'header.files': same('{n} file{s} · {tests}'),
  'header.tests.none': same('no tests yet'),
  'header.tests.failing': same('{n} failing'),
  'header.tests.pass': same('{n} test{s} passing'),
  'route.rule': same('route'),
  'compact.next': same('next: {title}'),

  'details.workingIn': same('working in: {files}'),
  'details.lastCommand.none': same('last command: none yet'),
  'details.lastCommand': same('last command: {cmd} → {gloss}'),
  'details.lastTest': same('last test run: {passed} passed, {failed} failed'),

  'footer.elapsed': same('{min} min'),
  'footer.stale': same(' · Claude last checked in {ago} ago'),

  'add.label': same(`Add a ${NOUN_STOP}`),
  'add.placeholder': same('e.g. Let people reset their password'),
  'add.submit': same('add'),
  'where.title': same('Where are we?'),
  'where.asking': same('Asking Claude… (uses about one message of your plan)'),
  'where.failed': same('Claude could not answer just now ({reason}).'),

  'badge.prefix': same('you changed this ·'),
  'badge.queued': same('~ queued: Claude sees it {when}'),
  'badge.when.gate': same('when it takes off'),
  'badge.when.flying': same('on its next step'),
  'badge.when.idle': same('with your next message'),
  'badge.delivered': same('✓ sent to Claude'),
  'badge.acked': same('✓✓ Claude has it'),
  'badge.unapplied': same('Claude has not applied this yet'),

  'editor.why': same('why: {why}'),
  'editor.detail': same('files: {files} · check: {check}'),
  'editor.claim': same('Claude says: {claim}'),
  'editor.rename.label': same('Change it to'),
  'editor.rename.submit': same('save'),
  'editor.hint.now': same('Claude finishes what it is doing, then changes course.'),
  'editor.hint.done': same('Claude redoes this after the current step.'),
  'editor.hint.gate': same('Claude sees this when it takes off.'),
  'editor.hint.idle': same('Claude sees this with your next message.'),
  'editor.hint.flying': same('Claude sees this after the current step ends.'),

  'decision.claude': same('Claude chose {choice}'),
  'decision.you': same('You chose {choice}'),
  'decision.because': same('Claude chose {choice} because {why}'),
  'decision.chip.flagged': same('review'),
  'decision.chip.kept': same('kept'),

  'toast.changed.gate': same('Changed on the map. Claude reads it when it takes off.'),
  'toast.changed.flying': same('Changed on the map. Claude reads it on its next step.'),
  'toast.changed.idle': same('Changed on the map. Claude reads it with your next message, or press send now.'),
  'toast.pause.set': same('Claude will pause after this step.'),
  'toast.pause.cancelled': same('Pause cancelled.'),
  'toast.nothingToSend': same('Nothing waiting to send.'),
  'toast.stopArm': same('Press Stop now again to interrupt Claude. A file may be left half-edited; Claude is told to check.'),
  'toast.undo.ok': same('Undone before Claude saw it.'),
  'toast.undo.late': same('Claude has already seen that change.'),

  // /flight replies, the chat spinner and the phone summary.
  'cmd.go.ok': same('Taking off.'),
  'cmd.gate.none': same('No route is waiting at the gate.'),
  'cmd.hold.ok': same('Holding: change anything on the map, then press Take off now.'),
  'cmd.pause.none': same('No flight in progress.'),
  'cmd.pause.ok': same('Claude will finish the step it is on, update the map, and stop.'),
  'cmd.details.on': same('Showing details on the map.'),
  'cmd.details.off': same('Hiding details on the map.'),
  'cmd.sound.on': same('Flight Plan sounds on.'),
  'cmd.sound.off': same('Flight Plan sounds off.'),
  'cmd.show.none': same('No flight plan yet.'),
  'cmd.show.header': same('{goal}: {done} of {total} done'),
  'cmd.show.line': same('{mark} {title} ({chip})'),
  'cmd.open.ok': same('Flight Plan map opened.'),
  'cmd.open.offscreen': same('The map is open but not on screen yet: {reason}'),
  'spinner.step': same('✈ Step {n} of {total} · {title}'),
  'pane.title': same('Flight Plan'),
  'mobile.none': same('No flight plan yet.'),
  'mobile.count': same('{done} of {total} steps done'),

  // What Claude is doing, as the map saw it. Stored in Live, so never voiced.
  'activity.edit': same('editing {file}'),
  'activity.read': same('reading {file}'),
  'activity.look': same('looking around the code'),
  'activity.web': same('looking something up'),
  'activity.helper': same('sending a helper'),
  'activity.ask': same('asking you something'),
  'activity.map': same('updating the map'),
  'activity.tool': same('using {tool}'),
  'gloss.tests': same('running the automatic checks'),
  'gloss.typecheck': same('checking the code for mistakes'),
  'gloss.lint': same('checking the code style'),
  'gloss.build': same('building the app'),
  'gloss.install': same('adding a ready-made code library'),
  'gloss.commit': same('saving a checkpoint'),
  'gloss.gitLook': same('looking at what changed'),
  'gloss.files': same('looking around the files'),
  'gloss.run': same('running the program'),
  'gloss.fallback': same('running a command'),
} as const satisfies Record<string, { fun: string; plain: string }>

export type WordKey = keyof typeof WORDS

// The three emoji, and what every other surface draws instead: the terminal
// (and plain voice) keeps the ✓ and ✈ text marks and drops the ticket.
export function glyphs(surface: string, voice: Voice): { check: string; plane: string; ticket: string } {
  return surface === 'desktop' && voice === 'fun' ? { check: '✅', plane: '✈️', ticket: '🎟️' } : { check: '✓', plane: '✈', ticket: '' }
}

// ✅ becomes ✓ off the desktop; ✈️ and 🎟️ sit only at a line's edge, so
// dropping them leaves the sentence whole.
function marksFor(text: string, surface: string): string {
  if (surface === 'desktop') return text

  return text
    .replaceAll('✅', glyphs(surface, 'fun').check)
    .replace(/^(?:✈️|🎟️) | (?:✈️|🎟️)$/gu, '')
    .replace(/✈️|🎟️/gu, '')
}

// A line in the chosen voice, slots filled. A slot with no value stays as
// "{name}" so a wiring slip shows in tests instead of reading as a fact.
// Values are never re-scanned, so a title holding "{x}" prints as written.
export function say(key: WordKey, voice: Voice, vars: Record<string, string | number> = {}, surface = 'desktop'): string {
  const entry: { fun: string; plain: string } | undefined = WORDS[key]
  if (entry === undefined) return key
  let count: number | undefined
  const text = entry[voice].replace(/\{(\w+)\}/g, (slot, name: string) => {
    if (name === 's' && vars.s === undefined) return count === 1 ? '' : 's'
    if (name === 'is' && vars.is === undefined) return count === 1 ? 'is' : 'are'
    const value = vars[name]
    if (value === undefined) return slot
    if (typeof value === 'number') count = value

    return String(value)
  })

  return marksFor(text, surface)
}

// What the sky clock says beside the time, from the scene pose (scene.ts
// ScenePose names). First match wins, as in the design's phrase table. The
// optional detail sharpens it: which gate state, which landing, the closed
// and live step counts, and a short-lived moment the pane times itself
// ('receipts' only while a step's checkedAt is fresh). 'chop' is a wobble
// with no words: it reads like 'air', so tool errors never say "bumpy air".
export type ClockDetail = {
  gate?: 'countdown' | 'held' | 'waiting'
  landing?: 'party' | 'quiet' | 'amber'
  done?: number
  total?: number
  moment?: 'receipts' | 'grew' | 'moved' | 'thinking'
  surface?: string
}

export function clockWord(pose: string, voice: Voice, detail: ClockDetail = {}): string {
  return say(phraseKey(pose, detail), voice, {}, detail.surface)
}

function phraseKey(pose: string, detail: ClockDetail): WordKey {
  if (pose === 'empty') return 'scene.phrase.empty'
  if (pose === 'boarding' || pose === 'ground') {
    if (detail.gate === 'held') return 'scene.phrase.gateHold'
    if (detail.gate === 'waiting') return 'scene.phrase.waitGo'
    if (detail.gate === 'countdown') return 'scene.phrase.boarding'
    return pose === 'boarding' ? 'scene.phrase.boarding' : 'scene.phrase.waitGo'
  }
  if (pose === 'landed') {
    if (detail.landing === 'party') return 'scene.phrase.landedAll'
    if (detail.landing === 'amber') return 'scene.phrase.landedFailing'
    if (detail.landing === 'quiet') return 'scene.phrase.landedUntested'
    return 'scene.phrase.landed'
  }
  if (pose === 'ask') return 'scene.phrase.yourTurn'
  if (pose === 'storm') return 'scene.phrase.bumpy'
  if (pose === 'paused') return 'scene.phrase.paused'
  if (pose === 'holding') return 'scene.phrase.holding'
  if (detail.moment === 'receipts') return 'scene.phrase.receipts'
  if (detail.moment === 'grew') return 'scene.phrase.grew'
  if (detail.moment === 'moved') return 'scene.phrase.nextStep'
  if (detail.moment === 'thinking') return 'scene.phrase.thinking'
  const { done, total } = detail
  if (done === undefined || total === undefined || total <= 0) return 'scene.phrase.cruising'
  if (done === 0) return 'scene.phrase.wheelsUp'
  if (total - done <= 2) return 'scene.phrase.approach'
  if (done * 3 < total) return 'scene.phrase.climbing'

  return 'scene.phrase.cruising'
}

// The landed card's tag and headline, its toast and its clock phrase, told by
// model.landingOf: TOUCHDOWN and "we ate" only for a party; quiet and amber
// say LANDED and name what is missing or failing, with counts.
export function landingWords(route: Route, voice: Voice, surface = 'desktop'): { tag: string; headline: string; toast: string; phrase: string } {
  const landing = landingOf(route)
  const live = route.steps.filter(step => step.status !== 'removed')
  const yours = live.filter(step => (step.status === 'checked' && step.doneBy === 'you') || isSkippedByYou(step)).length
  const line = (key: WordKey, vars: Record<string, number> = {}) => say(key, voice, vars, surface)
  const phrase = clockWord('landed', voice, { landing, surface })

  if (landing === 'party') {
    const tag = line('card.landed.tag.party')
    if (yours === 0) return { tag, headline: line('card.landed.headline.allChecked'), toast: line('toast.landed.allChecked'), phrase }
    const counts = { checked: live.filter(hasReceipts).length, yours }
    return { tag, headline: line('card.landed.headline.allCheckedYours', counts), toast: line('toast.landed.allCheckedYours', counts), phrase }
  }
  const tag = line('card.landed.tag')
  if (landing === 'amber') {
    const failing = route.tests?.failed ?? 0
    if (failing > 0) return { tag, headline: line('card.landed.headline.failing', { n: failing }), toast: line('toast.landed.failing', { n: failing }), phrase }
    const headline = line('card.landed.headline.failedSteps', { n: live.filter(step => step.status === 'failed').length })
    return { tag, headline, toast: headline, phrase }
  }
  const untested = live.filter(step => step.status === 'done').length
  if (untested > 0) return { tag, headline: line('card.landed.headline.untested', { n: untested }), toast: line('toast.landed.untested', { n: untested }), phrase }
  const skipped = live.filter(step => step.status === 'skipped' && step.doneBy !== 'you').length
  const headline =
    skipped > 0
      ? line('card.landed.headline.skipped', { n: skipped })
      : yours > 0
        ? line('card.landed.headline.yours', { n: yours })
        : line('card.landed.headline.quiet')

  return { tag, headline, toast: headline, phrase }
}

const GLOSSES: [RegExp, WordKey][] = [
  [/\b(node\s+--test|npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|bun\s+test|jest|vitest|mocha)\b/, 'gloss.tests'],
  [/\b(pytest|python3?\s+-m\s+(pytest|unittest)|go\s+test|cargo\s+test)\b/, 'gloss.tests'],
  [/\btsc\b/, 'gloss.typecheck'],
  [/\beslint\b/, 'gloss.lint'],
  [/\b(npm|pnpm|yarn)\s+(run\s+)?build\b/, 'gloss.build'],
  [/\b(npm|pnpm|yarn)\s+(install|add|i)\b|\bpip3?\s+install\b/, 'gloss.install'],
  [/\bgit\s+commit\b/, 'gloss.commit'],
  [/\bgit\s+(status|diff|log)\b/, 'gloss.gitLook'],
  [/\b(ls|find|cat|head|tail|grep|rg)\b/, 'gloss.files'],
  [/\b(node|python3?|deno|bun)\s+\S+/, 'gloss.run'],
]

// A command in everyday words, in the -ing form so it reads as an activity.
export function gloss(command: string): string {
  for (const [pattern, key] of GLOSSES) if (pattern.test(command)) return say(key, 'plain')

  return say('gloss.fallback', 'plain')
}

export function activityFor(tool: string, file: string | undefined, command: string | undefined, description: string | undefined): string {
  if ((tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') && file !== undefined) return say('activity.edit', 'plain', { file: basename(file) })
  if (tool === 'Bash' && command !== undefined) return description !== undefined && description.trim() !== '' ? lower(description.trim()) : gloss(command)
  if (tool === 'Read' && file !== undefined) return say('activity.read', 'plain', { file: basename(file) })
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob' || tool === 'LS' || tool === 'LSP') return say('activity.look', 'plain')
  if (tool === 'WebFetch' || tool === 'WebSearch') return say('activity.web', 'plain')
  if (tool === 'Agent' || tool === 'Task') return say('activity.helper', 'plain')
  if (tool === 'AskUserQuestion') return say('activity.ask', 'plain')
  if (tool === 'mcp__flightplan__route') return say('activity.map', 'plain')

  return say('activity.tool', 'plain', { tool: tool.replace(/^mcp__[^_]+__/, '') })
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

export function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

// v1's names for the plain words, kept unchanged until the pane reads say().
export const COPY = {
  empty: 'No flight plan yet. Tell Claude what to build; when the work has more than one step, the route appears here.',
  readyHint: 'Click any step to change it before Claude starts.',
  holdHint: 'Clock paused. Change anything, then press Take off.',
  editHint: 'Claude sees this after the current step ends.',
  nowHint: 'Claude finishes what it is doing, then changes course.',
  doneHint: 'Claude redoes this after the current step.',
  turbulence: 'It usually gets there, but you can nudge it.',
  holdingIdle: 'your turn: reply in the chat, or press Continue',
  waitingQuestion: 'Answer in the chat; the plane circles until you do.',
  legend: [
    'v  done and checked: a test the map saw pass',
    '*  in progress; the plane sits on the step',
    'o  not started yet',
    '!  done? the last test failed',
    '<> a choice Claude made without asking you',
    '~  your change, waiting for Claude',
    '⚑  landing: everything checked',
  ],
}
