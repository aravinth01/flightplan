import type { BoxProps, ButtonProps, ElementConstructor, InputProps, RenderElement, SelectProps, SvgProps, TextProps } from 'claude-code'

import type { Decision, Edit, EditKind, Feature, Live, Route, Step, View } from '../types'
import { counts, featureSteps, impactText, isClosed, isUnapplied } from './model'
import { CONFETTI, GLYPHS, SPRITES } from './sprites'
import type { Pose } from './sprites'
import { COPY, ago, gloss } from './text'

// The map, drawn from plain state with the elements every remote surface
// shares. Rules that keep the tree valid: Buttons hold strings and Text only;
// the Svg is always a sibling leaf; no Text width; no per-side borders.

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
}

type Card = 'empty' | 'ready' | 'now' | 'ask' | 'turbulence' | 'holding' | 'paused' | 'landed'

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

const CHIP: Record<Step['status'], string> = {
  pending: '',
  active: 'now',
  done: 'done, not tested',
  checked: 'checked',
  failed: 'done? last test failed',
  skipped: 'skipped',
  blocked: 'blocked',
  removed: 'removed',
}

function stepChip(step: Step, isPlane: boolean): string {
  if (step.status === 'done' && step.doneBy === 'claude') return step.claim !== undefined && step.claim !== 'none' ? 'done, Claude says' : 'done, not tested'
  if (step.status === 'checked' && step.doneBy === 'you') return 'you checked it'
  if (step.status === 'skipped' && step.doneBy === 'you') return 'skipped by you'
  if (step.status === 'removed') return step.removedBy === 'claude' ? 'dropped by Claude' : 'removed by you'
  if (step.status === 'active' && !isPlane) return 'started'

  return CHIP[step.status]
}

const stepGlyph = (step: Step) =>
  ({ pending: 'o', active: '*', done: 'v', checked: 'v', failed: '!', skipped: '-', blocked: '#', removed: 'x' })[step.status]

const chipColor = (step: Step) =>
  step.status === 'checked' ? 'success' : step.status === 'failed' || step.status === 'blocked' ? 'warning' : step.status === 'active' ? 'claude' : undefined

export type Moment = 'gate' | 'flying' | 'idle'

export function momentOf(route: Route | null, live: Live): Moment {
  if (route !== null && (route.gate === 'waiting' || route.gate === 'held')) return 'gate'

  return live.isRunning ? 'flying' : 'idle'
}

function badgeText(edit: Edit, moment: Moment): { text: string; color: string } {
  if (edit.state === 'acked') return { text: '✓✓ Claude has it', color: 'success' }
  if (isUnapplied(edit)) return { text: 'Claude has not applied this yet', color: 'error' }
  if (edit.state === 'delivered') return { text: '✓ sent to Claude', color: 'claude' }
  const when = moment === 'gate' ? 'when it takes off' : moment === 'flying' ? 'on its next step' : 'with your next message'

  return { text: `~ queued: Claude sees it ${when}`, color: 'warning' }
}

export function drawPane(el: Elements, d: Draw, act: Actions): RenderElement {
  const { Box, Text, Button, Input } = el
  const { route, live, view, now } = d
  const card = cardOf(route, live)
  const pose = poseOf(route, live, now)
  const showSvg = el.Svg !== undefined && !d.isCalm
  const rule = (label: string) => {
    const width = Math.max(10, Math.min(d.columns, 60))
    const side = Math.max(2, Math.floor((width - label.length - 2) / 2))

    return `${'─'.repeat(side)} ${label} ${'─'.repeat(side)}`
  }
  const planeEl = (size: number) =>
    showSvg && el.Svg !== undefined ? (
      <el.Svg source={SPRITES[pose]} alt={`The plane: ${pose === 'holding' ? 'waiting for you' : 'Claude is here'}`} width={size} height={size} isInteractive />
    ) : (
      <Text color="claude">{GLYPHS[pose]}</Text>
    )
  const editsFor = (target: string) => (route?.edits ?? []).filter(edit => edit.target === target && edit.state !== 'acked')
  const isEditing = view.open !== null
  const queuedCount = (route?.edits ?? []).filter(edit => edit.state === 'queued').length

  // ---- header and bar
  const header: RenderElement[] = []
  if (route !== null && route.steps.length > 0) {
    const c = counts(route)
    const where =
      card === 'landed' ? 'landed' : card === 'ready' ? 'ready for takeoff' : c.position > 0 ? `step ${c.position} of ${c.total}` : `${c.done} of ${c.total} done`
    const isNew = route.addedCount > 0 && now - route.addedAt < 60_000
    const tests = route.tests === null ? 'no tests yet' : route.tests.failed > 0 ? `${route.tests.failed} failing` : `${route.tests.passed} tests pass`
    header.push(
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
          <Text dimColor>{`] ${c.done} done · ~${c.left} left`}</Text>
          {isNew ? <Text color="warning">{` +${route.addedCount} new`}</Text> : ''}
        </Text>
        <Text dimColor>{`${route.files.length} files · ${tests}`}</Text>
      </Box>,
    )
  }

  // ---- the card: one place to look for "is it ok"
  const cardBox = (kind: Card, color: string, children: (RenderElement | string)[]) => (
    <Box key={`card-${kind}`} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginTop={header.length > 0 ? 1 : 0}>
      {children}
    </Box>
  )
  const tagRow = (tag: string, color: string, rest: string, withPlane: boolean) => (
    <Box key="tag" flexDirection="row" gap={1} alignItems="center">
      {withPlane ? <Box key="card-plane" flexShrink={0}>{planeEl(26)}</Box> : ''}
      <Text bold color={color}>
        {tag}
      </Text>
      <Text wrap="wrap">{rest}</Text>
    </Box>
  )
  const buttons = (children: RenderElement[]) => (
    <Box key="btns" flexDirection="row" flexWrap="wrap" gap={1} marginTop={0}>
      {children}
    </Box>
  )
  let cardEl: RenderElement
  const planeStep = route?.steps.find(step => step.id === route.plane)
  const withCardPlane = d.isCompact || card !== 'now'
  switch (card) {
    case 'empty':
      cardEl = cardBox('empty', 'subtle', [tagRow('ON THE GROUND', 'subtle', '', true), <Text key="t" dimColor wrap="wrap">{COPY.empty}</Text>])
      break
    case 'ready': {
      const c = counts(route as Route)
      const clock = route?.gate === 'held' ? 'held' : !view.isCountdown ? 'waiting for Take off' : view.open !== null ? `clock paused while you edit (${view.countdown} s)` : `taking off in ${view.countdown} s`
      cardEl = cardBox('ready', 'planMode', [
        tagRow('READY FOR TAKEOFF', 'planMode', `${c.total} steps under ${(route as Route).features.length} waypoints · ${clock}`, true),
        <Text key="hint" dimColor wrap="wrap">{route?.gate === 'held' ? COPY.holdHint : COPY.readyHint}</Text>,
        buttons([
          <Button key="takeoff" label="Take off now" variant="primary" onPress={() => act.takeOff()} />,
          ...(route?.gate === 'held' ? [] : [<Button key="hold" label="Hold, let me look" onPress={() => act.hold()} />]),
        ]),
      ])
      break
    }
    case 'ask':
      cardEl = cardBox('ask', 'permission', [
        tagRow('YOUR TURN', 'permission', `Claude asks: ${live.waiting?.question ?? 'a question'}`, true),
        <Text key="hint" dimColor wrap="wrap">{COPY.waitingQuestion}</Text>,
        buttons([<Button key="showq" label="Show me" onPress={() => act.showQuestion()} />]),
      ])
      break
    case 'turbulence':
      cardEl = cardBox('turbulence', 'warning', [
        tagRow('TURBULENCE', 'warning', `${live.failedRuns} test runs in a row failed on "${planeStep?.title ?? 'this step'}"`, true),
        <Text key="hint" dimColor wrap="wrap">{COPY.turbulence}</Text>,
        buttons([
          <Button key="nudge" label="Try another way" onPress={() => act.nudge()} />,
          ...(planeStep !== undefined ? [<Button key="skipstuck" label="Skip this step" onPress={() => act.edit('skip', planeStep.id)} />] : []),
        ]),
      ])
      break
    case 'holding': {
      const open = (route?.steps ?? []).filter(step => step.status === 'active' || step.status === 'pending' || step.status === 'failed')
      const unclosed = (route?.steps ?? []).filter(step => step.status === 'active')
      const blockedCount = (route?.steps ?? []).filter(step => step.status === 'blocked').length
      cardEl = cardBox('holding', 'subtle', [
        tagRow('HOLDING', 'subtle', planeStep !== undefined ? `at "${planeStep.title}"` : `${open.length} steps to go`, true),
        <Text key="hint" dimColor wrap="wrap">
          {blockedCount > 0 ? `${blockedCount} step${blockedCount > 1 ? 's are' : ' is'} blocked; ${COPY.holdingIdle}.` : unclosed.length > 0 ? `Claude stopped with ${unclosed.length} step${unclosed.length > 1 ? 's' : ''} not closed on the map; ${COPY.holdingIdle}.` : `${COPY.holdingIdle}.`}
        </Text>,
        buttons([
          <Button key="resume" label="Continue" variant="primary" onPress={() => act.resume()} />,
          ...(unclosed.length > 0 ? [<Button key="askupdate" label="Ask Claude to update the map" onPress={() => act.askToUpdate()} />] : []),
          ...(queuedCount > 0 ? [<Button key="sendnow" label={`Send ${queuedCount} change${queuedCount > 1 ? 's' : ''} now`} onPress={() => act.sendNow()} />] : []),
        ]),
      ])
      break
    }
    case 'paused':
      cardEl = cardBox('paused', 'subtle', [
        tagRow('PAUSED', 'subtle', planeStep !== undefined ? `after "${planeStep.title}"` : '', true),
        buttons([<Button key="resume" label="Continue" variant="primary" onPress={() => act.resume()} />]),
      ])
      break
    case 'landed': {
      const r = route as Route
      const c = counts(r)
      const untested = r.steps.filter(step => step.status === 'done')
      const flagged = r.decisions.filter(decision => decision.state === 'flagged')
      const minutes = Math.max(1, Math.round((r.landedAt - r.setAt) / 60_000))
      cardEl = cardBox('landed', 'success', [
        tagRow('LANDED', 'success', `${c.total} steps · ${r.files.length} files · ${r.tests === null ? 'no tests seen' : r.tests.failed > 0 ? `${r.tests.passed} passing, ${r.tests.failed} failing` : `${r.tests.passed} tests passing`} · ${minutes} min`, true),
        ...(untested.length > 0
          ? [
              <Box key="untested" flexDirection="row" gap={1} flexWrap="wrap">
                <Text>{`${untested.length} done but not tested`}</Text>
                <Button key="askcheck" label="Ask Claude to check" onPress={() => act.askToCheck()} />
              </Box>,
            ]
          : []),
        ...(flagged.length > 0
          ? [
              <Box key="flagged" flexDirection="row" gap={1} flexWrap="wrap">
                <Text>{`${flagged.length} choice${flagged.length > 1 ? 's' : ''} to review`}</Text>
                <Button key="review" label="Review" onPress={() => act.open(flagged[0]?.id ?? null)} />
              </Box>,
            ]
          : []),
        ...(live.cost !== null ? [<Text key="cost" dimColor>{`This flight's session cost so far: $${live.cost.toFixed(2)}`}</Text>] : []),
      ])
      break
    }
    default: {
      const details = view.isDetailsOn
        ? [
            <Text key="files" dimColor wrap="wrap">{`working in: ${planeStep !== undefined && planeStep.files.length > 0 ? planeStep.files.join('  ') : '—'}`}</Text>,
            <Text key="cmd" dimColor wrap="wrap">
              {live.lastCommand === '' ? 'last command: none yet' : `last command: ${live.lastCommand.slice(0, 60)} → ${gloss(live.lastCommand)}`}
            </Text>,
            ...(route?.tests !== null && route?.tests !== undefined
              ? [<Text key="tests" dimColor>{`last test run: ${route.tests.passed} passed, ${route.tests.failed} failed`}</Text>]
              : []),
          ]
        : []
      cardEl = cardBox('now', 'claude', [
        tagRow('NOW', 'claude', route?.doing !== '' && route?.doing !== undefined ? route.doing : (planeStep?.title ?? 'getting started'), withCardPlane),
        <Text key="activity" dimColor wrap="truncate-end">
          {`${live.activity === '' ? 'thinking' : live.activity} · ${ago(now - live.activityAt)} ago`}
        </Text>,
        ...details,
        buttons([
          <Button key="pause" label={route?.isPaused ? 'Pausing after this step' : 'Pause after this step'} hotkey={isEditing ? undefined : 'p'} onPress={() => act.pause()} />,
          <Button key="addwp" label="Add a feature" onPress={() => act.open('add-feature')} />,
          <Button key="where" label="Where?" onPress={() => act.where()} />,
        ]),
      ])
    }
  }

  // ---- the route
  const routeRows: RenderElement[] = []
  if (route !== null && route.steps.length > 0 && !(d.isCompact && card === 'now')) {
    routeRows.push(<Text key="rule-route" dimColor>{rule('route')}</Text>)
    route.features.forEach((feature, featureIndex) => {
      routeRows.push(...featureRows(el, d, act, route, feature, featureIndex, card, showSvg, pose))
      for (const decision of route.decisions.filter(one => one.afterFeature === feature.id)) {
        routeRows.push(...decisionRows(el, d, act, route, decision))
      }
    })
    routeRows.push(
      <Box key="landing" flexDirection="row" gap={1}>
        <Text color={card === 'landed' ? 'success' : undefined}>⚑</Text>
        <Text>Landing: everything checked</Text>
        {card === 'landed' && showSvg && el.Svg !== undefined ? <el.Svg source={CONFETTI} alt="confetti" width={22} height={22} isInteractive /> : ''}
      </Box>,
    )
  }
  if (d.isCompact && card === 'now' && route !== null) {
    const next = route.steps.find(step => step.status === 'pending')
    if (next !== undefined) routeRows.push(<Text key="next" dimColor wrap="truncate-end">{`next: ${next.title}`}</Text>)
  }

  // ---- add-a-feature card
  const addCard =
    view.open === 'add-feature' && route !== null ? (
      <Box key="add-card" flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginTop={1}>
        <Input
          key="add-feature"
          label="New feature"
          placeholder="e.g. Let people reset their password"
          submitLabel="add"
          onSubmit={value => act.edit('add-feature', 'route', value)}
        />
        <Box key="add-btns" flexDirection="row" gap={1}>
          <Button key="add-close" label="Close" onPress={() => act.open(null)} />
        </Box>
        <Text key="add-hint" dimColor wrap="wrap">
          It appears as "proposed by you" until Claude plans its steps.
        </Text>
      </Box>
    ) : (
      ''
    )

  // ---- where are we? answer, legend, footer
  const whereCard =
    view.whereAnswer !== '' ? (
      <Box key="where-card" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} marginTop={1}>
        <Text bold>Where are we?</Text>
        <Text wrap="wrap">{view.whereAnswer}</Text>
        <Button key="where-close" label="Close" onPress={() => act.dismissWhere()} />
      </Box>
    ) : (
      ''
    )
  const legend = view.isLegendOn ? (
    <Box key="legend" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} marginTop={1}>
      {COPY.legend.map((line, index) => (
        <Text key={`lg-${index}`} dimColor>
          {line}
        </Text>
      ))}
    </Box>
  ) : (
    ''
  )
  const footer =
    route !== null && route.steps.length > 0 ? (
      <Box key="footer" flexDirection="column" marginTop={1}>
        <Text dimColor>{rule('')}</Text>
        <Box key="foot-row" flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Text dimColor wrap="truncate-end">
            {`${Math.max(0, Math.round(((route.landedAt || now) - route.setAt) / 60_000))} min${now - route.lastClaudeAt > 120_000 && route.landedAt === 0 ? ` · Claude last checked in ${ago(now - route.lastClaudeAt)} ago` : ''}`}
          </Text>
          <Box key="foot-btns" flexDirection="row" gap={1}>
            <Button key="details" plain label={view.isDetailsOn ? 'hide details' : 'details'} hotkey={isEditing ? undefined : 'd'} onPress={() => act.toggleDetails()} />
            <Button key="legend-btn" plain label={view.isLegendOn ? 'hide legend' : 'legend'} onPress={() => act.toggleLegend()} />
          </Box>
        </Box>
      </Box>
    ) : (
      ''
    )

  return (
    <Box flexDirection="column" width={d.columns}>
      {header}
      {cardEl}
      {addCard}
      {whereCard}
      {routeRows}
      {legend}
      {footer}
    </Box>
  )
}

function featureRows(
  el: Elements,
  d: Draw,
  act: Actions,
  route: Route,
  feature: Feature,
  featureIndex: number,
  card: Card,
  showSvg: boolean,
  pose: Pose,
): RenderElement[] {
  const { Box, Text, Button } = el
  const steps = featureSteps(route, feature.id)
  const live = steps.filter(step => step.status !== 'removed')
  const hasPlane = steps.some(step => step.id === route.plane)
  const isAllDone = live.length > 0 && live.every(isClosed)
  const isAllChecked = live.length > 0 && live.every(step => step.status === 'checked' || step.status === 'skipped')
  const hasFailed = live.some(step => step.status === 'failed')
  const isOpenByYou = d.view.open === feature.id || steps.some(step => step.id === d.view.open)
  const isExpanded = hasPlane || isOpenByYou || hasFailed || (card === 'ready' && featureIndex === 0)
  const glyph = feature.proposedBy === 'you' ? '+' : live.length === 0 ? 'x' : isAllDone ? 'v' : hasPlane ? '*' : hasFailed ? '!' : 'o'
  const position = live.findIndex(step => step.id === route.plane) + 1
  const chip =
    feature.proposedBy === 'you'
      ? 'proposed by you'
      : live.length === 0
        ? 'removed by you'
        : isAllDone
          ? isAllChecked
            ? 'checked'
            : 'done, not tested'
          : hasPlane && position > 0
            ? `${position} of ${live.length}`
            : `${live.length} step${live.length > 1 ? 's' : ''}`
  const rows: RenderElement[] = [
    <Box key={`f-${feature.id}`} flexDirection="row" gap={1}>
      <Text color={isAllDone ? 'success' : hasPlane ? 'claude' : hasFailed ? 'warning' : undefined}>{glyph}</Text>
      <Button key={`fb-${feature.id}`} plain onPress={() => act.open(d.view.open === feature.id ? null : feature.id)}>
        {feature.title}
        <Text dimColor>{`  ${chip}`}</Text>
      </Button>
    </Box>,
  ]
  if (!isExpanded) {
    rows.push(
      <Text key={`fw-${feature.id}`} dimColor italic wrap="truncate-end">
        {`│  ${feature.why}`}
      </Text>,
    )
  }
  for (const edit of editsOf(route, feature.id, d.now)) rows.push(badgeRow(el, act, edit, `fe-${edit.id}`, momentOf(route, d.live)))
  if (d.view.open === feature.id) rows.push(featureEditor(el, act, feature))
  if (isExpanded) {
    steps.forEach((step, index) => {
      const isPlane = step.id === route.plane && route.landedAt === 0
      const isLast = index === steps.length - 1
      rows.push(
        <Box key={`s-${step.id}`} flexDirection="row">
          <Text dimColor>{isLast ? '└─ ' : '├─ '}</Text>
          <Box key={`g-${step.id}`} width={4} flexShrink={0}>
            {isPlane && showSvg && el.Svg !== undefined ? (
              <el.Svg source={SPRITES[pose]} alt="The plane: Claude is here" width={20} height={20} isInteractive />
            ) : (
              <Text color={isPlane ? 'claude' : chipColor(step)}>{isPlane ? GLYPHS[pose] : stepGlyph(step)}</Text>
            )}
          </Box>
          <Box key={`c-${step.id}`} flexDirection="column" flexGrow={1} flexShrink={1}>
            <Button key={`sb-${step.id}`} plain onPress={() => act.open(d.view.open === step.id ? null : step.id)}>
              {step.status === 'removed' ? <Text strikethrough dimColor>{step.title}</Text> : step.title}
              <Text color={chipColor(step)} dimColor={chipColor(step) === undefined}>{`  ${stepChip(step, isPlane)}`}</Text>
            </Button>
            {isPlane && d.live.isRunning ? (
              <Text key={`sw-${step.id}`} dimColor italic wrap="truncate-end">
                {step.why}
              </Text>
            ) : (
              ''
            )}
          </Box>
        </Box>,
      )
      if (isPlane) {
        for (const helper of d.live.helpers.filter(one => !one.isDone)) {
          rows.push(
            <Text key={`h-${helper.id}`} dimColor wrap="truncate-end">
              {`${isLast ? '   ' : '│  '}    > helper: ${helper.description} …`}
            </Text>,
          )
        }
        if (d.live.errorsInRow >= 2) {
          rows.push(
            <Text key={`r-${step.id}`} color="warning">
              {`${isLast ? '   ' : '│  '}    retry ${d.live.errorsInRow}`}
            </Text>,
          )
        }
      }
      for (const edit of editsOf(route, step.id, d.now)) rows.push(badgeRow(el, act, edit, `se-${edit.id}`, momentOf(route, d.live)))
      if (d.view.open === step.id) rows.push(stepEditor(el, act, route, step, d.live))
    })
  }
  rows.push(
    <Text key={`fs-${feature.id}`} dimColor>
      │
    </Text>,
  )

  return rows
}

// Acknowledged changes stay visible for a minute, so "Claude has it" is seen.
const editsOf = (route: Route, target: string, now: number) =>
  route.edits.filter(edit => edit.target === target && edit.kind !== 'note' && (edit.state !== 'acked' || now - edit.ackedAt < 60_000))

function badgeRow(el: Elements, act: Actions, edit: Edit, key: string, moment: Moment): RenderElement {
  const { Box, Text, Button } = el
  const badge = badgeText(edit, moment)

  return (
    <Box key={key} flexDirection="row" gap={1} flexWrap="wrap" marginLeft={3}>
      <Text dimColor>you changed this ·</Text>
      <Text color={badge.color}>{badge.text}</Text>
      {edit.state === 'queued' ? <Button key={`undo-${edit.id}`} plain label="undo" onPress={() => act.undo(edit.id)} /> : ''}
      {isUnapplied(edit) ? <Button key={`resend-${edit.id}`} plain label="send now" onPress={() => act.sendNow()} /> : ''}
    </Box>
  )
}

function stepEditor(el: Elements, act: Actions, route: Route, step: Step, live: Live): RenderElement {
  const { Box, Text, Button, Input } = el
  const isPlane = step.id === route.plane && live.isRunning
  const isDone = isClosed(step) || step.status === 'failed'
  const actions: RenderElement[] = []
  if (step.status === 'removed' || (step.status === 'skipped' && step.doneBy === 'you')) {
    const edit = route.edits.find(one => one.target === step.id && one.state === 'queued' && one.kind === (step.status === 'removed' ? 'remove' : 'skip'))
    if (edit !== undefined) actions.push(<Button key={`ed-undo-${step.id}`} label="Undo" onPress={() => act.undo(edit.id)} />)
  } else if (isPlane) {
    actions.push(
      <Button key={`ed-stop-${step.id}`} label="Stop now" onPress={() => act.stopNow(step.id)} />,
      <Button key={`ed-skip-${step.id}`} label="Skip it after this attempt" onPress={() => act.edit('skip', step.id)} />,
    )
  } else if (isDone) {
    actions.push(
      <Button key={`ed-redo-${step.id}`} label="Redo this" onPress={() => act.edit('redo', step.id)} />,
      <Button key={`ed-checked-${step.id}`} label="I checked it" onPress={() => act.edit('checked', step.id)} />,
    )
  } else {
    actions.push(
      <Button key={`ed-skip-${step.id}`} label="Skip it" onPress={() => act.edit('skip', step.id)} />,
      <Button key={`ed-remove-${step.id}`} label="Remove it" onPress={() => act.edit('remove', step.id)} />,
    )
  }
  const moment = momentOf(route, live)
  const hint = isPlane ? COPY.nowHint : isDone ? COPY.doneHint : moment === 'gate' ? 'Claude sees this when it takes off.' : moment === 'idle' ? 'Claude sees this with your next message.' : COPY.editHint
  const detail =
    step.files.length > 0 || step.check !== ''
      ? `${step.files.length > 0 ? `files: ${step.files.join(', ')}` : ''}${step.files.length > 0 && step.check !== '' ? ' · ' : ''}${step.check !== '' ? `check: ${step.check}` : ''}`
      : ''

  return (
    <Box key={`ed-${step.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
      <Text key={`ed-why-${step.id}`} dimColor italic wrap="wrap">
        {step.why === '' ? 'why: —' : `why: ${step.why}`}
      </Text>
      {detail !== '' ? (
        <Text key={`ed-detail-${step.id}`} dimColor wrap="wrap">
          {detail}
        </Text>
      ) : (
        ''
      )}
      {step.claim !== undefined ? <Text key={`ed-claim-${step.id}`} dimColor wrap="wrap">{`Claude says: ${step.claim}`}</Text> : ''}
      {step.status !== 'removed' ? (
        <Input key={`rn-${step.id}`} label="Change it to" value={step.title} submitLabel="save" onSubmit={value => act.edit('rename', step.id, value)} />
      ) : (
        ''
      )}
      <Box key={`ed-btns-${step.id}`} flexDirection="row" flexWrap="wrap" gap={1}>
        {actions}
        <Button key={`ed-close-${step.id}`} label="Close" onPress={() => act.open(null)} />
      </Box>
      <Text key={`ed-hint-${step.id}`} dimColor wrap="wrap">
        {hint}
      </Text>
    </Box>
  )
}

function featureEditor(el: Elements, act: Actions, feature: Feature): RenderElement {
  const { Box, Text, Button, Input } = el

  return (
    <Box key={`fed-${feature.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
      <Text key={`fed-why-${feature.id}`} dimColor italic wrap="wrap">
        {feature.why === '' ? 'why: —' : `why: ${feature.why}`}
      </Text>
      <Input key={`frn-${feature.id}`} label="Change it to" value={feature.title} submitLabel="save" onSubmit={value => act.edit('rename', feature.id, value)} />
      <Box key={`fed-btns-${feature.id}`} flexDirection="row" flexWrap="wrap" gap={1}>
        <Button key={`fed-remove-${feature.id}`} label="Remove this feature" onPress={() => act.edit('remove', feature.id)} />
        <Button key={`fed-close-${feature.id}`} label="Close" onPress={() => act.open(null)} />
      </Box>
      <Text key={`fed-hint-${feature.id}`} dimColor wrap="wrap">
        {COPY.editHint}
      </Text>
    </Box>
  )
}

function decisionRows(el: Elements, d: Draw, act: Actions, route: Route, decision: Decision): RenderElement[] {
  const { Box, Text, Button } = el
  const isMine = decision.state === 'switched' || decision.state === 'yours'
  const line = isMine ? `You chose ${decision.userChoice ?? decision.choice}` : `Claude chose ${decision.choice}`
  const rows: RenderElement[] = [
    <Box key={`d-${decision.id}`} flexDirection="row" gap={1}>
      <Text color={decision.state === 'flagged' ? 'warning' : 'subtle'}>{'<>'}</Text>
      <Button key={`db-${decision.id}`} plain onPress={() => act.open(d.view.open === decision.id ? null : decision.id)}>
        {line}
        <Text color={decision.state === 'flagged' ? 'warning' : undefined} dimColor={decision.state !== 'flagged'}>
          {decision.state === 'flagged' ? '  review' : decision.state === 'kept' ? '  kept' : ''}
        </Text>
      </Button>
    </Box>,
    <Text key={`dw-${decision.id}`} dimColor italic wrap="truncate-end">
      {`│  ${decision.question}${decision.why === '' ? '' : ` · ${decision.why}`}`}
    </Text>,
  ]
  for (const edit of editsOf(route, decision.id, d.now)) rows.push(badgeRow(el, act, edit, `de-${edit.id}`, momentOf(route, d.live)))
  if (d.view.open === decision.id) {
    rows.push(
      <Box key={`ded-${decision.id}`} flexDirection="column" borderStyle="round" borderColor="planMode" paddingX={1} marginLeft={3}>
        <Text key="q" bold wrap="wrap">
          {decision.question}
        </Text>
        <Text key="why" dimColor wrap="wrap">
          {decision.why === '' ? `Claude chose ${decision.choice}` : `Claude chose ${decision.choice} because ${decision.why}`}
        </Text>
        <Text key="impact" wrap="wrap">
          {impactText(route, decision)}
        </Text>
        <Box key="dbtns" flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key={`keep-${decision.id}`} label={`Keep ${decision.choice}`} onPress={() => act.keep(decision.id)} />
          {decision.alternatives.map((alternative, index) => (
            <Button key={`sw-${decision.id}-${index}`} label={`Switch to ${alternative}`} onPress={() => act.edit('switch', decision.id, alternative)} />
          ))}
          <Button key={`why-${decision.id}`} label="Ask Claude why" onPress={() => act.askWhy(decision.id)} />
          <Button key={`first-${decision.id}`} label="Ask me first next time" onPress={() => act.askFirst()} />
          <Button key={`dclose-${decision.id}`} label="Close" onPress={() => act.open(null)} />
        </Box>
      </Box>,
    )
  }
  rows.push(
    <Text key={`ds-${decision.id}`} dimColor>
      │
    </Text>,
  )

  return rows
}

// The band above the prompt: one line while the map is not on screen.
export function drawBand(el: Elements, d: Draw, onOpen: () => void, act: Actions): RenderElement | undefined {
  const { Box, Text, Button } = el
  const { route, live, view, now } = d
  if (route === null || route.steps.length === 0) return undefined
  const card = cardOf(route, live)
  const c = counts(route)
  const step = route.steps.find(one => one.id === route.plane)
  const label =
    card === 'ready'
      ? `Route ready: ${c.total} steps · ${route.gate === 'held' ? 'held' : view.isCountdown ? `taking off in ${view.countdown} s` : 'waiting for Take off'}`
      : card === 'landed'
        ? `Landed: ${c.done} of ${c.total} done`
        : card === 'ask'
          ? 'Your turn: Claude asked you something'
          : `${c.position > 0 ? `step ${c.position} of ${c.total}` : `${c.done} of ${c.total} done`}${step !== undefined ? ` · ${step.title}` : ''}${live.isRunning && live.activity !== '' ? ` · ${live.activity}` : ''}`

  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
      <Text color="claude">{GLYPHS[poseOf(route, live, now)]}</Text>
      <Text wrap="truncate-end">{`Flight Plan  ${label}`}</Text>
      <Button key="band-open" label="Open map" onPress={() => onOpen()} />
      {card === 'ready' ? <Button key="band-takeoff" label="Take off now" onPress={() => act.takeOff()} /> : ''}
      {card === 'ready' && route.gate !== 'held' ? <Button key="band-hold" label="Hold" onPress={() => act.hold()} /> : ''}
    </Box>
  )
}
