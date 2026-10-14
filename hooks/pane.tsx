import type { BoxProps, ButtonProps, ElementConstructor, InputProps, RenderElement, SelectProps, SvgProps, TextProps } from 'claude-code'

import type { Decision, Edit, EditKind, Feature, Live, Route, Step, View } from '../types'
import { GLYPHS } from './art'
import type { Pose } from './art'
import { counts, featureSteps, hasReceipts, impactText, isClosed, isStopVerified, isUnapplied, landingOf } from './model'
import { ONE_SHOT_MS, clockOf, sceneAlt, sceneKey, sceneSize, sceneSvg, signCells, signOf } from './scene'
import type { PinState, SceneKey } from './scene'
import { ago, clockWord, gloss, landingWords, say } from './text'
import type { ClockDetail, Voice, WordKey } from './text'

// The map, drawn from plain state with the elements every remote surface
// shares: the sky on top (the pixel picture on the desktop, two text lines
// elsewhere), then the header, the card, and the route as boarding passes.
// Rules that keep the tree valid: Buttons hold strings and Text only (chips
// are sibling Text); one Svg at most, the sky, always a leaf; no Text width;
// no per-side borders; Box widths are whole cells or equal shares (width 0,
// flexGrow 1). Words come from text.ts in the person's voice; the few marks
// and labels written here (FROM/TO, files:, check:) read the same in both.

export type Elements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Input: ElementConstructor<InputProps>
  Select: ElementConstructor<SelectProps>
  Svg?: ElementConstructor<SvgProps>
}

export type Actions = {
  open: (id: string | null) => void
  edit: (kind: EditKind, target: string, value?: string) => void
  undo: (editId: string) => void
  takeOff: () => void
  hold: () => void
  pause: () => void
  resume: () => void
  stopNow: (stepId: string) => void
  askToCheck: () => void
  askToUpdate: () => void
  askWhy: (decisionId: string) => void
  keep: (decisionId: string) => void
  askFirst: () => void
  where: () => void
  toggleDetails: () => void
  toggleLegend: () => void
  sendNow: () => void
  showQuestion: () => void
  nudge: () => void
  dismissWhere: () => void
}

export type Draw = {
  route: Route | null
  live: Live
  view: View
  now: number
  columns: number
  isCompact: boolean
  isCalm: boolean
  /** The Words setting: light gen-z ('fun', the default) or plain. */
  voice: Voice
  /** Where it is drawn (desktop, terminal, vscode): the emoji are desktop-only. */
  surface: string
}

type Card = 'empty' | 'ready' | 'now' | 'ask' | 'turbulence' | 'holding' | 'paused' | 'landed'

type Say = (key: WordKey, vars?: Record<string, string | number>) => string

// A line in the person's voice, with only the marks their surface draws.
const wordsFor =
  (d: Pick<Draw, 'voice' | 'surface'>): Say =>
  (key, vars = {}) =>
    say(key, d.voice, vars, d.surface)

export function cardOf(route: Route | null, live: Live): Card {
  if (route === null || route.steps.length === 0) return 'empty'
  if (route.landedAt > 0) return 'landed'
  if (live.waiting !== null) return 'ask'
  if ((route.gate === 'waiting' || route.gate === 'held') && !live.isRunning) return 'ready'
  if (live.isRunning && live.failedRuns >= 3) return 'turbulence'
  if (!live.isRunning && route.isPaused) return 'paused'
  if (!live.isRunning) return 'holding'

  return 'now'
}

// The plane's text glyph (terminal, calm, band): no picture to show the pose.
export function poseOf(route: Route | null, live: Live, now: number): Pose {
  if (route === null) return 'parked'
  if (route.landedAt > 0) return 'landed'
  if (live.waiting !== null) return 'holding'
  if (live.failedRuns >= 2 || live.errorsInRow >= 3) return 'turbulence'
  if (live.celebrateUntil > now) return 'celebrate'
  if (now - route.movedAt < 1500) return 'flying'
  if (!live.isRunning) return 'parked'
  if (now - live.activityAt > 5000) return 'thinking'

  return 'cruise'
}

// ---------------------------------------------------------------- step chips

export type ChipKind =
  | 'pending'
  | 'now'
  | 'started'
  | 'receipts'
  | 'youChecked'
  | 'claudeSays'
  | 'untested'
  | 'failed'
  | 'skipped'
  | 'youSkipped'
  | 'blocked'
  | 'claudeDropped'
  | 'youRemoved'

// The one honesty mapping for a step's chip. Receipts only for a test run
// the map saw pass; "I checked it" stays the person's word and "done" stays
// Claude's (or the map's), never a check.
export function chipKindOf(step: Step, isPlane: boolean): ChipKind {
  switch (step.status) {
    case 'active':
      return isPlane ? 'now' : 'started'
    case 'done':
      return step.doneBy === 'claude' && step.claim !== undefined && step.claim !== 'none' ? 'claudeSays' : 'untested'
    case 'checked':
      return hasReceipts(step) ? 'receipts' : 'youChecked'
    case 'failed':
      return 'failed'
    case 'skipped':
      return step.doneBy === 'you' ? 'youSkipped' : 'skipped'
    case 'blocked':
      return 'blocked'
    case 'removed':
      return step.removedBy === 'claude' ? 'claudeDropped' : 'youRemoved'
    default:
      return 'pending'
  }
}

const CHIP: Record<ChipKind, { word: WordKey | null; glyph: string; color?: string }> = {
  pending: { word: null, glyph: 'o' },
  now: { word: 'step.chip.now', glyph: '*', color: 'claude' },
  started: { word: 'step.chip.started', glyph: '*', color: 'claude' },
  receipts: { word: 'step.chip.checked', glyph: '✓', color: 'success' },
  youChecked: { word: 'step.chip.youChecked', glyph: '✓' },
  claudeSays: { word: 'step.chip.claudeSays', glyph: '✓' },
  untested: { word: 'step.chip.done', glyph: '✓' },
  failed: { word: 'step.chip.failed', glyph: '!', color: 'warning' },
  skipped: { word: 'step.chip.skipped', glyph: '-' },
  youSkipped: { word: 'step.chip.youSkipped', glyph: '-' },
  blocked: { word: 'step.chip.blocked', glyph: '#', color: 'warning' },
  claudeDropped: { word: 'step.chip.claudeDropped', glyph: 'x' },
  youRemoved: { word: 'step.chip.youRemoved', glyph: 'x' },
}

// Receipts that just landed: the step's chip flashes inverse for the
// stamp's window (the sky stamps the pin over the same window).
export const isFreshReceipts = (step: Step, now: number) =>
  hasReceipts(step) && step.checkedAt !== undefined && now >= step.checkedAt && now - step.checkedAt < ONE_SHOT_MS.stamp

export type Moment = 'gate' | 'flying' | 'idle'

export function momentOf(route: Route | null, live: Live): Moment {
  if (route !== null && (route.gate === 'waiting' || route.gate === 'held')) return 'gate'

  return live.isRunning ? 'flying' : 'idle'
}

function badgeText(edit: Edit, moment: Moment, t: Say): { text: string; color: string } {
  if (edit.state === 'acked') return { text: t('badge.acked'), color: 'success' }
  if (isUnapplied(edit)) return { text: t('badge.unapplied'), color: 'error' }
  if (edit.state === 'delivered') return { text: t('badge.delivered'), color: 'claude' }
  const when = t(moment === 'gate' ? 'badge.when.gate' : moment === 'flying' ? 'badge.when.flying' : 'badge.when.idle')

  return { text: t('badge.queued', { when }), color: 'warning' }
}

// The stops the person sees numbered, as the sky pins them: those with a
// live step, or one the person proposed (not capped at 8 like the pins).
const liveStops = (route: Route) =>
  route.features.filter(feature => feature.proposedBy === 'you' || route.steps.some(step => step.featureId === feature.id && step.status !== 'removed'))

const rule = (columns: number, label: string) => {
  const width = Math.max(10, Math.min(columns, 60))
  const side = Math.max(2, Math.floor((width - label.length - 2) / 2))

  return `${'─'.repeat(side)} ${label} ${'─'.repeat(side)}`
}

// ---------------------------------------------------------------- the pane

export function drawPane(el: Elements, d: Draw, act: Actions): RenderElement {
  const { Box } = el
  const card = cardOf(d.route, d.live)
  const header = d.route !== null && d.route.steps.length > 0 ? drawHeader(el, d, d.route, card) : []

  // The sky is the first child (R19), so its index never shifts; the rest
  // keep v1's '' placeholders.
  return (
    <Box flexDirection="column" width={d.columns}>
      {drawSky(el, d)}
      {header}
      {drawCard(el, d, act, card, header.length > 0)}
      {addCard(el, d, act)}
      {whereCard(el, d, act)}
      {drawRoute(el, d, act, card)}
      {legendBox(el, d)}
      {footerBox(el, d, act)}
    </Box>
  )
}

// ---------------------------------------------------------------- the sky

const SIGN_STYLE: Record<PinState, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  pending: { dimColor: true },
  current: { color: 'claude', bold: true },
  done: {},
  verified: { color: 'success' },
  failed: { color: 'warning' },
  yours: { color: 'planMode' },
}

const PIN_MARK: Record<PinState, { mark: string; color?: string }> = {
  pending: { mark: 'o' },
  current: { mark: '✈', color: 'claude' },
  done: { mark: '✓' },
  verified: { mark: '✓', color: 'success' },
  failed: { mark: '!', color: 'warning' },
  yours: { mark: '+', color: 'planMode' },
}

// The clock row, then the picture and the signs under its pins (R1, R3,
// R8). The picture's source comes from the scene key alone, so a redraw for
// anything else (the clock word, activity, the countdown, an open editor)
// hands the frame the same bytes and its animation keeps running. Inline
// panes get the strip; the terminal and calm get two text lines instead.
function drawSky(el: Elements, d: Draw): RenderElement {
  const { Box, Text } = el
  const Svg = d.isCalm ? undefined : el.Svg
  const key = sceneKey({ route: d.route, live: d.live, now: d.now, columns: d.columns, isStrip: d.isCompact, isCalm: Svg === undefined })
  if (Svg === undefined) {
    return (
      <Box key="sky" flexDirection="column">
        {clockRow(el, d, key)}
        {glyphRoute(el, d, key)}
      </Box>
    )
  }
  const size = sceneSize(d.columns, d.isCompact)
  const { left, right } = signCells(key, size.cells)
  const n = key.pins.length
  // Each sign keeps one free cell in its share, so neighbours never run
  // together, and needs room for 3 more to say anything.
  const room = n > 0 ? Math.floor((size.cells - left - right) / n) - 1 : 0
  const hasSigns = n > 0 && room >= 3

  return (
    <Box key="sky" flexDirection="column" flexShrink={0}>
      {clockRow(el, d, key)}
      <Svg source={sceneSvg(key)} alt={sceneAlt(key)} width={size.pxW} height={size.pxH} isInteractive />
      {hasSigns ? (
        <Box key="signs" flexDirection="row" width={size.cells}>
          {left > 0 ? <Box key="signs-left" width={left} flexShrink={0} /> : ''}
          {key.pins.map((pin, i) => (
            <Box key={`sign-${i}`} width={0} flexGrow={1} flexDirection="row" justifyContent="center">
              <Text {...SIGN_STYLE[pin.state]} wrap="truncate-end">
                {fitSign(pin.sign, room)}
              </Text>
            </Box>
          ))}
          {right > 0 ? <Box key="signs-right" width={right} flexShrink={0} /> : ''}
        </Box>
      ) : (
        ''
      )}
    </Box>
  )
}

// A sign cut to `room` cells with an ellipsis, whole characters only (a
// sign may hold any script; a wide one still truncates in the Text).
function fitSign(sign: string, room: number): string {
  const chars = [...sign]
  if (chars.length <= room) return sign

  return `${chars.slice(0, Math.max(1, room - 1)).join('')}…`
}

// "☀ 10:20 AM · cruising": sky time (it moves only when steps close, never
// in seconds) as a chip, then the voiced word for the moment.
function clockRow(el: Elements, d: Draw, key: SceneKey): RenderElement {
  const { Text } = el
  const { route, view } = d
  const c = route === null ? undefined : counts(route)
  const detail: ClockDetail = {
    gate: route?.gate === 'held' ? 'held' : view.isCountdown ? 'countdown' : 'waiting',
    done: c?.done,
    total: c?.total,
    moment: clockMoment(route, d.live, d.now),
    surface: d.surface,
  }
  if (route !== null && route.landedAt > 0) detail.landing = landingOf(route)

  return (
    <Text key="clock" wrap="truncate-end">
      <Text inverse color="claude">{` ☀ ${clockOf(route).label} `}</Text>
      <Text dimColor>{' · '}</Text>
      <Text bold>{clockWord(key.pose, d.voice, detail)}</Text>
    </Text>
  )
}

// The clock word for a moment the pane times itself: a step's fresh
// receipts, a route that grew in the last minute, the plane just moving,
// or five quiet seconds. Text only, so the picture never changes for it.
function clockMoment(route: Route | null, live: Live, now: number): ClockDetail['moment'] {
  if (route === null) return undefined
  if (route.steps.some(step => isFreshReceipts(step, now))) return 'receipts'
  if (route.addedCount > 0 && now - route.addedAt < 60_000) return 'grew'
  if (now - route.movedAt < 1500) return 'moved'
  if (live.isRunning && now - live.activityAt > 5000) return 'thinking'

  return undefined
}

// The text sky: one mark per pin, the plane on its way to the current one
// (or at the gate), and the landing flag: "✓ · ✈ · o · ⚑".
function glyphRoute(el: Elements, d: Draw, key: SceneKey): RenderElement {
  const { Text } = el
  const plane = GLYPHS[poseOf(d.route, d.live, d.now)]
  const marks: { mark: string; color?: string }[] = [
    ...(key.pose === 'empty' || key.atGate ? [{ mark: plane, color: 'claude' }] : []),
    ...key.pins.map(pin => (pin.state === 'current' ? { mark: plane, color: 'claude' } : PIN_MARK[pin.state])),
    key.landing === 'party' ? { mark: '⚑', color: 'success' } : key.landing === 'amber' ? { mark: '⚑', color: 'warning' } : { mark: '⚑' },
  ]
  const sep = marks.length * 4 <= d.columns ? ' · ' : ' '
  const parts: RenderElement[] = []
  marks.forEach((one, i) => {
    if (i > 0) parts.push(<Text dimColor>{sep}</Text>)
    parts.push(
      <Text color={one.color} dimColor={one.color === undefined}>
        {one.mark}
      </Text>,
    )
  })

  return (
    <Text key="line" wrap="truncate-end">
      {parts}
    </Text>
  )
}

// ---------------------------------------------------------------- header

function drawHeader(el: Elements, d: Draw, route: Route, card: Card): RenderElement[] {
  const { Box, Text } = el
  const t = wordsFor(d)
  const c = counts(route)
  const where =
    card === 'landed'
      ? t('header.where.landed')
      : card === 'ready'
        ? t('header.where.ready')
        : c.position > 0
          ? t('header.where.step', { n: c.position, total: c.total })
          : t('header.where.count', { done: c.done, total: c.total })
  const isNew = route.addedCount > 0 && d.now - route.addedAt < 60_000
  const tests =
    route.tests === null
      ? t('header.tests.none')
      : route.tests.failed > 0
        ? t('header.tests.failing', { n: route.tests.failed })
        : t('header.tests.pass', { n: route.tests.passed })

  return [
    <Box key="hdr" flexDirection="row" justifyContent="space-between" gap={1}>
      <Text bold wrap="truncate-end">
        {route.goal}
      </Text>
      <Text dimColor>{where}</Text>
    </Box>,
    <Box key="bar" flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={2}>
      <Text>
        <Text dimColor>[</Text>
        <Text color="success">{'#'.repeat(c.done)}</Text>
        <Text dimColor>{'.'.repeat(Math.max(0, c.left))}</Text>
        <Text dimColor>{`] ${t('header.bar', { done: c.done, left: c.left })}`}</Text>
        {isNew ? <Text color="warning">{t('header.grew', { n: route.addedCount })}</Text> : ''}
      </Text>
      <Text dimColor>{t('header.files', { n: route.files.length, tests })}</Text>
    </Box>,
  ]
}

// ---------------------------------------------------------------- the card

// What the captain (Claude) is up to, as the card's chip.
function captainChip(card: Card, route: Route | null, live: Live, now: number): WordKey {
  switch (card) {
    case 'empty':
      return 'captain.chip.empty'
    case 'ready':
      return 'captain.chip.ready'
    case 'ask':
    case 'holding':
      return 'captain.chip.waiting'
    case 'turbulence':
      return 'captain.chip.bumpy'
    case 'paused':
      return 'captain.chip.paused'
    case 'landed':
      return 'captain.chip.landed'
    default:
      if (route !== null && route.steps.some(step => isFreshReceipts(step, now))) return 'captain.chip.receipts'
      if (route !== null && now - route.movedAt < 1500) return 'captain.chip.flying'
      if (now - live.activityAt > 5000) return 'captain.chip.thinking'

      return 'captain.chip.cruise'
  }
}

// One place to look for "is it ok": the tag, the captain's chip, a
// headline, a hint and the buttons for this moment.
function drawCard(el: Elements, d: Draw, act: Actions, card: Card, hasHeader: boolean): RenderElement {
  const { Box, Text, Button } = el
  const t = wordsFor(d)
  const { route, live, view, now } = d
  const planeStep = route?.steps.find(step => step.id === route.plane)
  const queuedCount = (route?.edits ?? []).filter(edit => edit.state === 'queued').length
  const box = (color: string, tag: string, rows: (RenderElement | string)[]) => (
    <Box key={`card-${card}`} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginTop={hasHeader ? 1 : 0}>
      <Box key="tag" flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={1}>
        <Text bold color={color}>
          {tag}
        </Text>
        <Text backgroundColor={color} color="inverseText" wrap="truncate-end">
          {` ${t('captain.row', { chip: t(captainChip(card, route, live, now)) })} `}
        </Text>
      </Box>
      {rows}
    </Box>
  )
  const line = (key: string, text: string, isDim = false) =>
    text === '' ? (
      ''
    ) : (
      <Text key={key} dimColor={isDim} wrap="wrap">
        {text}
      </Text>
    )
  const buttons = (children: RenderElement[]) => (
    <Box key="btns" flexDirection="row" flexWrap="wrap" gap={1}>
      {children}
    </Box>
  )

  switch (card) {
    case 'empty':
      return box('subtle', t('card.empty.tag'), [line('t', t('card.empty.body'), true)])
    case 'ready': {
      const r = route as Route
      const clock =
        r.gate === 'held'
          ? t('card.ready.clock.held')
          : !view.isCountdown
            ? t('card.ready.clock.waitGo')
            : view.open !== null
              ? t('card.ready.clock.editing', { n: view.countdown })
              : t('card.ready.clock.countdown', { n: view.countdown })

      return box('planMode', t('card.ready.tag'), [
        line('head', t('card.ready.summary', { total: counts(r).total, stops: liveStops(r).length, clock })),
        line('hint', t(r.gate === 'held' ? 'card.ready.hintHeld' : 'card.ready.hint'), true),
        buttons([
          <Button key="takeoff" label={t('btn.takeoff')} variant="primary" onPress={() => act.takeOff()} />,
          ...(r.gate === 'held' ? [] : [<Button key="hold" label={t('btn.hold')} onPress={() => act.hold()} />]),
        ]),
      ])
    }
    case 'ask':
      return box('permission', t('card.ask.tag'), [
        line('head', t('card.ask.summary', { question: live.waiting?.question ?? t('card.ask.fallback') })),
        line('hint', t('card.ask.hint'), true),
        buttons([<Button key="showq" label={t('btn.showQuestion')} onPress={() => act.showQuestion()} />]),
      ])
    case 'turbulence':
      return box('warning', t('card.turbulence.tag'), [
        line('head', t('card.turbulence.summary', { n: live.failedRuns, title: planeStep?.title ?? t('card.turbulence.fallbackTitle') })),
        line('hint', t('card.turbulence.hint'), true),
        buttons([
          <Button key="nudge" label={t('btn.nudge')} onPress={() => act.nudge()} />,
          ...(planeStep !== undefined ? [<Button key="skipstuck" label={t('btn.skipStuck')} onPress={() => act.edit('skip', planeStep.id)} />] : []),
        ]),
      ])
    case 'holding': {
      const steps = route?.steps ?? []
      const open = steps.filter(step => step.status === 'active' || step.status === 'pending' || step.status === 'failed')
      const unclosed = steps.filter(step => step.status === 'active').length
      const blocked = steps.filter(step => step.status === 'blocked').length
      const idle = t('card.holding.idle')

      return box('subtle', t('card.holding.tag'), [
        line('head', planeStep !== undefined ? t('card.holding.at', { title: planeStep.title }) : t('card.holding.toGo', { n: open.length })),
        line(
          'hint',
          blocked > 0 ? t('card.holding.blocked', { n: blocked, idle }) : unclosed > 0 ? t('card.holding.unclosed', { n: unclosed, idle }) : idle,
          true,
        ),
        buttons([
          <Button key="resume" label={t('btn.continue')} variant="primary" onPress={() => act.resume()} />,
          ...(unclosed > 0 ? [<Button key="askupdate" label={t('btn.askUpdate')} onPress={() => act.askToUpdate()} />] : []),
          ...(queuedCount > 0 ? [<Button key="sendnow" label={t('btn.sendCount', { n: queuedCount })} onPress={() => act.sendNow()} />] : []),
        ]),
      ])
    }
    case 'paused':
      return box('subtle', t('card.paused.tag'), [
        line('head', planeStep !== undefined ? t('card.paused.after', { title: planeStep.title }) : ''),
        line('hint', t('card.paused.hint'), true),
        buttons([<Button key="resume" label={t('btn.continue')} variant="primary" onPress={() => act.resume()} />]),
      ])
    case 'landed': {
      const r = route as Route
      const landing = landingOf(r)
      // TOUCHDOWN and "we ate" only on a party landing (landingWords).
      const words = landingWords(r, d.voice, d.surface)
      const untested = r.steps.filter(step => step.status === 'done').length
      const flagged = r.decisions.filter(decision => decision.state === 'flagged')
      const minutes = Math.max(1, Math.round((r.landedAt - r.setAt) / 60_000))
      const tests =
        r.tests === null
          ? t('card.landed.tests.none')
          : r.tests.failed > 0
            ? t('card.landed.tests.mixed', { passed: r.tests.passed, failed: r.tests.failed })
            : t('card.landed.tests.pass', { passed: r.tests.passed })

      return box(landing === 'party' ? 'success' : landing === 'amber' ? 'warning' : 'subtle', words.tag, [
        <Text key="head" bold wrap="wrap">
          {words.headline}
        </Text>,
        line('sum', t('card.landed.summary', { total: counts(r).total, files: r.files.length, tests, min: minutes }), true),
        ...(untested > 0
          ? [
              <Box key="untested" flexDirection="row" gap={1} flexWrap="wrap">
                <Text>{t('card.landed.untested', { n: untested })}</Text>
                <Button key="askcheck" label={t('btn.askCheck')} onPress={() => act.askToCheck()} />
              </Box>,
            ]
          : []),
        ...(flagged.length > 0
          ? [
              <Box key="flagged" flexDirection="row" gap={1} flexWrap="wrap">
                <Text>{t('card.landed.flagged', { n: flagged.length })}</Text>
                <Button key="review" label={t('btn.review')} onPress={() => act.open(flagged[0]?.id ?? null)} />
              </Box>,
            ]
          : []),
        ...(live.cost !== null ? [<Text key="cost" dimColor>{t('card.landed.cost', { cost: live.cost.toFixed(2) })}</Text>] : []),
      ])
    }
    default: {
      const details = view.isDetailsOn
        ? [
            <Text key="files" dimColor wrap="wrap">
              {t('details.workingIn', { files: planeStep !== undefined && planeStep.files.length > 0 ? planeStep.files.join('  ') : '—' })}
            </Text>,
            <Text key="cmd" dimColor wrap="wrap">
              {live.lastCommand === '' ? t('details.lastCommand.none') : t('details.lastCommand', { cmd: live.lastCommand.slice(0, 60), gloss: gloss(live.lastCommand) })}
            </Text>,
            ...(route?.tests !== null && route?.tests !== undefined
              ? [<Text key="tests" dimColor>{t('details.lastTest', { passed: route.tests.passed, failed: route.tests.failed })}</Text>]
              : []),
          ]
        : []

      return box('claude', t('card.now.tag'), [
        line('head', route?.doing !== '' && route?.doing !== undefined ? route.doing : (planeStep?.title ?? t('card.now.fallback'))),
        <Text key="activity" dimColor wrap="truncate-end">
          {t('card.now.activity', { activity: live.activity === '' ? t('activity.thinking') : live.activity, ago: ago(now - live.activityAt) })}
        </Text>,
        ...details,
        buttons([
          <Button
            key="pause"
            label={t(route?.isPaused === true ? 'btn.pausing' : 'btn.pause')}
            hotkey={view.open !== null ? undefined : 'p'}
            onPress={() => act.pause()}
          />,
          <Button key="addwp" label={t('btn.addStop')} onPress={() => act.open('add-feature')} />,
          <Button key="where" label={t('btn.where')} onPress={() => act.where()} />,
        ]),
      ])
    }
  }
}

// ---------------------------------------------------------------- the route

function drawRoute(el: Elements, d: Draw, act: Actions, card: Card): RenderElement[] {
  const { Box, Text } = el
  const t = wordsFor(d)
  const { route } = d
  const rows: RenderElement[] = []
  if (route === null || route.steps.length === 0) return rows
  if (d.isCompact && card === 'now') {
    const next = route.steps.find(step => step.status === 'pending')
    if (next !== undefined) {
      rows.push(
        <Text key="next" dimColor wrap="truncate-end">
          {t('compact.next', { title: next.title })}
        </Text>,
      )
    }

    return rows
  }
  const stops = liveStops(route)
  rows.push(
    <Text key="rule-route" dimColor>
      {rule(d.columns, t('route.rule'))}
    </Text>,
  )
  route.features.forEach((feature, featureIndex) => {
    rows.push(...stopRows(el, d, act, route, feature, featureIndex, card, stops))
    for (const decision of route.decisions.filter(one => one.afterFeature === feature.id)) rows.push(...decisionRows(el, d, act, route, decision))
  })
  // The flag is green only after a party landing; amber when tests fail.
  const landing = card === 'landed' ? landingOf(route) : null
  rows.push(
    <Box key="landing" flexDirection="row" gap={1}>
      <Text color={landing === 'party' ? 'success' : landing === 'amber' ? 'warning' : undefined}>⚑</Text>
      <Text>{t('route.landing')}</Text>
    </Box>,
  )

  return rows
}

// How a stop reads at a glance: its mark, its chip, and its pass's color.
// The green mark follows R6 (the flag's rule); the words claim receipts on
// every step only when every step has them, and "no receipts yet" only when
// none has.
export function stopLook(route: Route, feature: Feature, live: Step[], hasPlane: boolean): { mark: string; color?: string; chip: WordKey | null } {
  if (live.length === 0) return feature.proposedBy === 'you' ? { mark: '+', color: 'planMode', chip: 'stop.chip.proposed' } : { mark: 'x', color: 'inactive', chip: 'stop.chip.removed' }
  if (live.some(step => step.status === 'failed')) return { mark: '!', color: 'warning', chip: 'stop.chip.failed' }
  if (isStopVerified(route, feature.id)) return { mark: '✓', color: 'success', chip: live.every(hasReceipts) ? 'stop.chip.checked' : 'stop.chip.checkedYours' }
  if (live.every(isClosed)) return { mark: '✓', chip: live.some(hasReceipts) ? null : 'stop.chip.untested' }
  if (hasPlane) return { mark: '✈', color: 'claude', chip: null }

  return { mark: 'o', chip: null }
}

// Each stop is a boarding pass. The one the plane is on (or one you opened,
// one with a failing step, the first while boarding: v1's expanded rule) is
// a full pass with its steps; every other stop folds into a one-line stub.
function stopRows(el: Elements, d: Draw, act: Actions, route: Route, feature: Feature, featureIndex: number, card: Card, stops: Feature[]): RenderElement[] {
  const { Box, Text, Button } = el
  const t = wordsFor(d)
  const steps = featureSteps(route, feature.id)
  const live = steps.filter(step => step.status !== 'removed')
  const hasPlane = steps.some(step => step.id === route.plane)
  const isOpenByYou = d.view.open === feature.id || steps.some(step => step.id === d.view.open)
  const isExpanded = hasPlane || isOpenByYou || live.some(step => step.status === 'failed') || (card === 'ready' && featureIndex === 0)
  const look = stopLook(route, feature, live, hasPlane)
  const stopIndex = stops.findIndex(one => one.id === feature.id)
  const sign = signOf(feature.title, stopIndex >= 0 ? stopIndex : featureIndex)
  const closed = live.filter(isClosed).length
  const count = live.length > 0 ? t('header.where.count', { done: closed, total: live.length }) : ''
  const chip = look.chip === null ? '' : t(look.chip)
  const open = () => act.open(d.view.open === feature.id ? null : feature.id)
  const why = feature.proposedBy === 'you' && feature.why === '' ? t('stop.why.proposed') : feature.why
  const badges = editsOf(route, feature.id, d.now).map(edit => badgeRow(el, d, act, edit, `fe-${edit.id}`))
  const editor = d.view.open === feature.id ? featureEditor(el, d, act, route, feature) : ''

  if (!isExpanded) {
    return [
      <Box key={`f-${feature.id}`} flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={1}>
        <Box key={`fl-${feature.id}`} flexDirection="row" columnGap={1} flexShrink={1}>
          <Text color={look.color} dimColor={look.color === undefined}>
            {look.mark}
          </Text>
          <Button key={`fb-${feature.id}`} plain onPress={open}>
            {feature.title}
          </Button>
        </Box>
        <Text wrap="truncate-end">
          <Text dimColor>{count}</Text>
          <Text color={look.color} dimColor={look.color === undefined}>
            {count !== '' && chip !== '' ? ` · ${chip}` : chip}
          </Text>
        </Text>
      </Box>,
      ...(card === 'ready' || why !== feature.why
        ? [
            <Text key={`fw-${feature.id}`} dimColor italic wrap="truncate-end">
              {`│  ${why}`}
            </Text>,
          ]
        : []),
      ...badges,
      ...(editor === '' ? [] : [editor]),
    ]
  }

  const [i, n] = stopIndex >= 0 ? [stopIndex + 1, stops.length] : [featureIndex + 1, route.features.length]
  const prev = stopIndex > 0 ? stops[stopIndex - 1] : undefined
  const from = prev === undefined ? t('pin.start') : signOf(prev.title, stopIndex - 1)
  const position = live.findIndex(step => step.id === route.plane) + 1
  const progress = position > 0 ? t('stop.chip.position', { pos: position, n: live.length }) : count
  const stepEls: RenderElement[] = []
  steps.forEach((step, index) => stepEls.push(...stepRows(el, d, act, route, step, index === steps.length - 1)))

  return [
    <Box key={`wp-${feature.id}`} flexDirection="column" borderStyle="round" borderColor={hasPlane ? 'claude' : (look.color ?? 'subtle')} paddingX={1}>
      <Text key={`ph-${feature.id}`} bold wrap="truncate-end">
        {t('pass.header', { i, n })}
      </Text>
      <Text key={`pr-${feature.id}`} dimColor wrap="truncate-end">
        {`FROM ${from} ✈ TO ${sign}${progress === '' ? '' : ` · ${progress}`}`}
      </Text>
      <Box key={`f-${feature.id}`} flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={1}>
        <Button key={`fb-${feature.id}`} plain onPress={open}>
          <Text bold>{feature.title}</Text>
        </Button>
        {chip !== '' ? (
          <Text color={look.color} dimColor={look.color === undefined}>
            {chip}
          </Text>
        ) : (
          ''
        )}
      </Box>
      {why !== feature.why ? (
        <Text key={`fw-${feature.id}`} dimColor italic wrap="truncate-end">
          {why}
        </Text>
      ) : (
        ''
      )}
      <Text key={`pt-${feature.id}`} dimColor wrap="truncate-end">
        {'┄'.repeat(Math.max(4, d.columns - 4))}
      </Text>
      {badges}
      {editor}
      {stepEls}
    </Box>,
  ]
}

// A step row inside a pass: the tree, a mark (the plane's step shows a
// still ✈), the title as a plain Button and the chip beside it, never in it.
function stepRows(el: Elements, d: Draw, act: Actions, route: Route, step: Step, isLast: boolean): RenderElement[] {
  const { Box, Text, Button } = el
  const t = wordsFor(d)
  const isPlane = step.id === route.plane && route.landedAt === 0
  const look = CHIP[chipKindOf(step, isPlane)]
  const hasPicture = el.Svg !== undefined && !d.isCalm
  const glyph = isPlane ? (hasPicture ? '✈' : GLYPHS[poseOf(route, d.live, d.now)]) : look.glyph
  const glyphColor = isPlane ? 'claude' : look.color
  const chip = isFreshReceipts(step, d.now) ? (
    <Text backgroundColor="success" color="inverseText">{` ${t('step.chip.checked')} `}</Text>
  ) : look.word === null ? (
    ''
  ) : (
    <Text color={look.color} dimColor={look.color === undefined}>
      {t(look.word)}
    </Text>
  )
  const indent = `${isLast ? '   ' : '│  '}   `
  const rows: RenderElement[] = [
    <Box key={`s-${step.id}`} flexDirection="row">
      <Text dimColor>{isLast ? '└─ ' : '├─ '}</Text>
      <Box key={`g-${step.id}`} width={3} flexShrink={0}>
        <Text color={glyphColor} dimColor={glyphColor === undefined}>
          {glyph}
        </Text>
      </Box>
      <Box key={`c-${step.id}`} flexDirection="column" flexGrow={1} flexShrink={1}>
        <Box key={`sr-${step.id}`} flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={1}>
          <Button key={`sb-${step.id}`} plain onPress={() => act.open(d.view.open === step.id ? null : step.id)}>
            {step.status === 'removed' ? (
              <Text strikethrough dimColor>
                {step.title}
              </Text>
            ) : (
              step.title
            )}
          </Button>
          {chip}
        </Box>
        {isPlane && d.live.isRunning ? (
          <Text key={`sw-${step.id}`} dimColor italic wrap="truncate-end">
            {step.why}
          </Text>
        ) : (
          ''
        )}
      </Box>
    </Box>,
  ]
  if (isPlane) {
    rows.push(...crewRows(el, d, indent))
    if (d.live.errorsInRow >= 2) {
      rows.push(
        <Text key={`r-${step.id}`} color="warning">
          {`${indent}${t('step.retry', { n: d.live.errorsInRow })}`}
        </Text>,
      )
    }
  }
  for (const edit of editsOf(route, step.id, d.now)) rows.push(badgeRow(el, d, act, edit, `se-${edit.id}`))
  if (d.view.open === step.id) rows.push(stepEditor(el, d, act, route, step))

  return rows
}

// The helpers Claude sent off, under the plane's step: nameless crew with
// Claude's own words for the job. Never a check: coming back is not proof.
function crewChip(helper: Live['helpers'][number], now: number): WordKey {
  if (helper.isError === true) return 'crew.chip.snag'
  if (helper.isDone) return 'crew.chip.back'
  if (helper.startedAt !== undefined && now - helper.startedAt >= 60_000) return 'crew.chip.stillAt'

  return 'crew.chip.onIt'
}

function crewRows(el: Elements, d: Draw, indent: string): RenderElement[] {
  const { Text } = el
  const t = wordsFor(d)
  const helpers = d.live.helpers
  const rows = helpers.slice(0, 3).map(helper => (
    <Text key={`h-${helper.id}`} color={helper.isError === true ? 'warning' : undefined} dimColor={helper.isError !== true} wrap="truncate-end">
      {`${indent}${t('crew.row', { chip: t(crewChip(helper, d.now)), description: helper.description })}`}
    </Text>
  ))
  if (helpers.length > 3) {
    rows.push(
      <Text key="h-more" dimColor>
        {`${indent}${t('crew.more', { n: helpers.length - 3 })}`}
      </Text>,
    )
  }

  return rows
}

// Acknowledged changes stay visible for a minute, so "Claude has it" is seen.
const editsOf = (route: Route, target: string, now: number) =>
  route.edits.filter(edit => edit.target === target && edit.kind !== 'note' && (edit.state !== 'acked' || now - edit.ackedAt < 60_000))

function badgeRow(el: Elements, d: Draw, act: Actions, edit: Edit, key: string): RenderElement {
  const { Box, Text, Button } = el
  const t = wordsFor(d)
  const badge = badgeText(edit, momentOf(d.route, d.live), t)

  return (
    <Box key={key} flexDirection="row" gap={1} flexWrap="wrap" marginLeft={3}>
      <Text dimColor>{t('badge.prefix')}</Text>
      <Text color={badge.color}>{badge.text}</Text>
      {edit.state === 'queued' ? <Button key={`undo-${edit.id}`} plain label={t('btn.undoSmall')} onPress={() => act.undo(edit.id)} /> : ''}
      {isUnapplied(edit) ? <Button key={`resend-${edit.id}`} plain label={t('btn.sendNowSmall')} onPress={() => act.sendNow()} /> : ''}
    </Box>
  )
}

// When Claude reads a change made in an editor.
const hintFor = (route: Route, live: Live): WordKey => {
  const moment = momentOf(route, live)

  return moment === 'gate' ? 'editor.hint.gate' : moment === 'idle' ? 'editor.hint.idle' : 'editor.hint.flying'
}

function stepEditor(el: Elements, d: Draw, act: Actions, route: Route, step: Step): RenderElement {
  const { Box, Text, Button, Input } = el
  const t = wordsFor(d)
  const isPlane = step.id === route.plane && d.live.isRunning
  const isDone = isClosed(step) || step.status === 'failed'
  const actions: RenderElement[] = []
  if (step.status === 'removed' || (step.status === 'skipped' && step.doneBy === 'you')) {
    const edit = route.edits.find(one => one.target === step.id && one.state === 'queued' && one.kind === (step.status === 'removed' ? 'remove' : 'skip'))
    if (edit !== undefined) actions.push(<Button key={`ed-undo-${step.id}`} label={t('btn.undo')} onPress={() => act.undo(edit.id)} />)
  } else if (isPlane) {
    actions.push(
      <Button key={`ed-stop-${step.id}`} label={t(d.view.armedStop === step.id ? 'btn.stopNow.armed' : 'btn.stopNow')} onPress={() => act.stopNow(step.id)} />,
      <Button key={`ed-skip-${step.id}`} label={t('btn.skipAfter')} onPress={() => act.edit('skip', step.id)} />,
    )
  } else if (isDone) {
    actions.push(
      <Button key={`ed-redo-${step.id}`} label={t('btn.redo')} onPress={() => act.edit('redo', step.id)} />,
      <Button key={`ed-checked-${step.id}`} label={t('btn.iChecked')} onPress={() => act.edit('checked', step.id)} />,
    )
  } else {
    actions.push(
      <Button key={`ed-skip-${step.id}`} label={t('btn.skip')} onPress={() => act.edit('skip', step.id)} />,
      <Button key={`ed-remove-${step.id}`} label={t('btn.remove')} onPress={() => act.edit('remove', step.id)} />,
    )
  }
  const hint = isPlane ? 'editor.hint.now' : isDone ? 'editor.hint.done' : hintFor(route, d.live)
  const detail = [step.files.length > 0 ? `files: ${step.files.join(', ')}` : '', step.check !== '' ? `check: ${step.check}` : ''].filter(one => one !== '').join(' · ')

  return (
    <Box key={`ed-${step.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
      <Text key={`ed-why-${step.id}`} dimColor italic wrap="wrap">
        {step.why === '' ? 'why: —' : t('editor.why', { why: step.why })}
      </Text>
      {detail !== '' ? (
        <Text key={`ed-detail-${step.id}`} dimColor wrap="wrap">
          {detail}
        </Text>
      ) : (
        ''
      )}
      {step.claim !== undefined ? (
        <Text key={`ed-claim-${step.id}`} dimColor wrap="wrap">
          {t('editor.claim', { claim: step.claim })}
        </Text>
      ) : (
        ''
      )}
      {step.status !== 'removed' ? (
        <Input
          key={`rn-${step.id}`}
          label={t('editor.rename.label')}
          value={step.title}
          submitLabel={t('editor.rename.submit')}
          onSubmit={value => act.edit('rename', step.id, value)}
        />
      ) : (
        ''
      )}
      <Box key={`ed-btns-${step.id}`} flexDirection="row" flexWrap="wrap" gap={1}>
        {actions}
        <Button key={`ed-close-${step.id}`} label={t('btn.close')} onPress={() => act.open(null)} />
      </Box>
      <Text key={`ed-hint-${step.id}`} dimColor wrap="wrap">
        {t(hint)}
      </Text>
    </Box>
  )
}

function featureEditor(el: Elements, d: Draw, act: Actions, route: Route, feature: Feature): RenderElement {
  const { Box, Text, Button, Input } = el
  const t = wordsFor(d)

  return (
    <Box key={`fed-${feature.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
      <Text key={`fed-why-${feature.id}`} dimColor italic wrap="wrap">
        {feature.why === '' ? 'why: —' : t('editor.why', { why: feature.why })}
      </Text>
      <Input
        key={`frn-${feature.id}`}
        label={t('editor.rename.label')}
        value={feature.title}
        submitLabel={t('editor.rename.submit')}
        onSubmit={value => act.edit('rename', feature.id, value)}
      />
      <Box key={`fed-btns-${feature.id}`} flexDirection="row" flexWrap="wrap" gap={1}>
        <Button key={`fed-remove-${feature.id}`} label={t('btn.removeStop')} onPress={() => act.edit('remove', feature.id)} />
        <Button key={`fed-close-${feature.id}`} label={t('btn.close')} onPress={() => act.open(null)} />
      </Box>
      <Text key={`fed-hint-${feature.id}`} dimColor wrap="wrap">
        {t(hintFor(route, d.live))}
      </Text>
    </Box>
  )
}

function decisionRows(el: Elements, d: Draw, act: Actions, route: Route, decision: Decision): RenderElement[] {
  const { Box, Text, Button } = el
  const t = wordsFor(d)
  const isMine = decision.state === 'switched' || decision.state === 'yours'
  const isFlagged = decision.state === 'flagged'
  const line = isMine ? t('decision.you', { choice: decision.userChoice ?? decision.choice }) : t('decision.claude', { choice: decision.choice })
  const chip = isFlagged ? t('decision.chip.flagged') : decision.state === 'kept' ? t('decision.chip.kept') : ''
  const rows: RenderElement[] = [
    <Box key={`d-${decision.id}`} flexDirection="row" columnGap={1} flexWrap="wrap">
      <Text color={isFlagged ? 'warning' : 'subtle'}>{'<>'}</Text>
      <Button key={`db-${decision.id}`} plain onPress={() => act.open(d.view.open === decision.id ? null : decision.id)}>
        {line}
      </Button>
      {chip !== '' ? (
        <Text color={isFlagged ? 'warning' : undefined} dimColor={!isFlagged}>
          {chip}
        </Text>
      ) : (
        ''
      )}
    </Box>,
    <Text key={`dw-${decision.id}`} dimColor italic wrap="truncate-end">
      {`│  ${decision.question}${decision.why === '' ? '' : ` · ${decision.why}`}`}
    </Text>,
  ]
  for (const edit of editsOf(route, decision.id, d.now)) rows.push(badgeRow(el, d, act, edit, `de-${edit.id}`))
  if (d.view.open === decision.id) {
    rows.push(
      <Box key={`ded-${decision.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
        <Text key="q" bold wrap="wrap">
          {decision.question}
        </Text>
        <Text key="why" dimColor wrap="wrap">
          {decision.why === '' ? t('decision.claude', { choice: decision.choice }) : t('decision.because', { choice: decision.choice, why: decision.why })}
        </Text>
        <Text key="impact" wrap="wrap">
          {impactText(route, decision)}
        </Text>
        <Box key="dbtns" flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key={`keep-${decision.id}`} label={t('btn.keep', { choice: decision.choice })} onPress={() => act.keep(decision.id)} />
          {decision.alternatives.map((alternative, index) => (
            <Button key={`sw-${decision.id}-${index}`} label={t('btn.switch', { alternative })} onPress={() => act.edit('switch', decision.id, alternative)} />
          ))}
          <Button key={`why-${decision.id}`} label={t('btn.askWhy')} onPress={() => act.askWhy(decision.id)} />
          <Button key={`first-${decision.id}`} label={t('btn.askFirst')} onPress={() => act.askFirst()} />
          <Button key={`dclose-${decision.id}`} label={t('btn.close')} onPress={() => act.open(null)} />
        </Box>
      </Box>,
    )
  }

  return rows
}

// ---------------------------------------------------------------- add, where, legend, footer

function addCard(el: Elements, d: Draw, act: Actions): RenderElement | string {
  const { Box, Text, Button, Input } = el
  if (d.view.open !== 'add-feature' || d.route === null) return ''
  const t = wordsFor(d)

  return (
    <Box key="add-card" flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginTop={1}>
      <Input
        key="add-feature"
        label={t('add.label')}
        placeholder={t('add.placeholder')}
        submitLabel={t('add.submit')}
        onSubmit={value => act.edit('add-feature', 'route', value)}
      />
      <Box key="add-btns" flexDirection="row" gap={1}>
        <Button key="add-close" label={t('btn.close')} onPress={() => act.open(null)} />
      </Box>
      <Text key="add-hint" dimColor wrap="wrap">
        {t('add.hint')}
      </Text>
    </Box>
  )
}

function whereCard(el: Elements, d: Draw, act: Actions): RenderElement | string {
  const { Box, Text, Button } = el
  if (d.view.whereAnswer === '') return ''
  const t = wordsFor(d)

  return (
    <Box key="where-card" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} marginTop={1}>
      <Text bold>{t('where.title')}</Text>
      <Text wrap="wrap">{d.view.whereAnswer}</Text>
      <Button key="where-close" label={t('btn.close')} onPress={() => act.dismissWhere()} />
    </Box>
  )
}

const LEGEND: WordKey[] = [
  'legend.checked',
  'legend.untested',
  'legend.now',
  'legend.pending',
  'legend.failed',
  'legend.decision',
  'legend.edit',
  'legend.landing',
  'legend.clock',
  'legend.crew',
]

function legendBox(el: Elements, d: Draw): RenderElement | string {
  const { Box, Text } = el
  if (!d.view.isLegendOn) return ''
  const t = wordsFor(d)

  return (
    <Box key="legend" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} marginTop={1}>
      {LEGEND.map((key, index) => (
        <Text key={`lg-${index}`} dimColor>
          {t(key)}
        </Text>
      ))}
    </Box>
  )
}

function footerBox(el: Elements, d: Draw, act: Actions): RenderElement | string {
  const { Box, Text, Button } = el
  const { route, now } = d
  if (route === null || route.steps.length === 0) return ''
  const t = wordsFor(d)
  const minutes = Math.max(0, Math.round(((route.landedAt || now) - route.setAt) / 60_000))
  const stale = now - route.lastClaudeAt > 120_000 && route.landedAt === 0 ? t('footer.stale', { ago: ago(now - route.lastClaudeAt) }) : ''
  const isEditing = d.view.open !== null

  return (
    <Box key="footer" flexDirection="column" marginTop={1}>
      <Text dimColor>{rule(d.columns, '')}</Text>
      <Box key="foot-row" flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Text dimColor wrap="truncate-end">
          {`${t('footer.elapsed', { min: minutes })}${stale}`}
        </Text>
        <Box key="foot-btns" flexDirection="row" gap={1}>
          <Button
            key="details"
            plain
            label={t(d.view.isDetailsOn ? 'btn.hideDetails' : 'btn.details')}
            hotkey={isEditing ? undefined : 'd'}
            onPress={() => act.toggleDetails()}
          />
          <Button key="legend-btn" plain label={t(d.view.isLegendOn ? 'btn.hideLegend' : 'btn.legend')} onPress={() => act.toggleLegend()} />
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------- the band

// The band above the prompt: one line while the map is not on screen.
export function drawBand(el: Elements, d: Draw, onOpen: () => void, act: Actions): RenderElement | undefined {
  const { Box, Text, Button } = el
  const { route, live, view, now } = d
  if (route === null || route.steps.length === 0) return undefined
  const t = wordsFor(d)
  const card = cardOf(route, live)
  const c = counts(route)
  const step = route.steps.find(one => one.id === route.plane)
  const clock =
    route.gate === 'held'
      ? t('card.ready.clock.held')
      : view.isCountdown
        ? t('card.ready.clock.countdown', { n: view.countdown })
        : t('card.ready.clock.waitGo')
  const where = c.position > 0 ? t('header.where.step', { n: c.position, total: c.total }) : t('header.where.count', { done: c.done, total: c.total })
  const label =
    card === 'ready'
      ? t('band.ready', { n: c.total, clock })
      : card === 'landed'
        ? t(landingOf(route) === 'party' ? 'band.landed.party' : 'band.landed', { done: c.done, total: c.total })
        : card === 'ask'
          ? t('band.ask')
          : [where, step?.title ?? '', live.isRunning ? live.activity : ''].filter(part => part !== '').join(' · ')

  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
      <Text color="claude">{GLYPHS[poseOf(route, live, now)]}</Text>
      <Text wrap="truncate-end">{t('band.line', { label })}</Text>
      <Button key="band-open" label={t('btn.openMap')} onPress={() => onOpen()} />
      {card === 'ready' ? <Button key="band-takeoff" label={t('btn.takeoff')} onPress={() => act.takeOff()} /> : ''}
      {card === 'ready' && route.gate !== 'held' ? <Button key="band-hold" label={t('btn.bandHold')} onPress={() => act.hold()} /> : ''}
    </Box>
  )
}
