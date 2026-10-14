// Flight Plan's state contract: the route Claude files and the map draws, what
// the map sees happening, and the pane's own view state.

export type StepStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'checked'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | 'removed'

export type Step = {
  id: string
  featureId: string
  title: string
  why: string
  files: string[]
  check: string
  status: StepStatus
  /** Who moved it to done: Claude's own report, or the map seeing the work. */
  doneBy?: 'claude' | 'seen' | 'you'
  /** What Claude said proved it (`node --test: 11 passed`), or `none`. */
  claim?: string
  /** Basenames of this step's declared files the map saw written. */
  written: string[]
  note?: string
  /** Who removed it: the person on the map, or Claude with patch drop. */
  removedBy?: 'you' | 'claude'
}

export type Feature = { id: string; title: string; why: string; proposedBy?: 'you' }

export type Decision = {
  id: string
  question: string
  choice: string
  alternatives: string[]
  why: string
  affects: string[]
  afterFeature: string
  state: 'flagged' | 'kept' | 'switched' | 'yours'
  userChoice?: string
}

export type EditKind = 'rename' | 'skip' | 'remove' | 'redo' | 'checked' | 'add-feature' | 'switch' | 'pause' | 'nudge' | 'note'

export type Edit = {
  id: string
  kind: EditKind
  target: string
  text: string
  /** queued: on the map, not yet sent; delivered: handed to Claude; acked: Claude's update reflects it. */
  state: 'queued' | 'delivered' | 'acked'
  /** Route calls since delivery that did not acknowledge it. */
  misses: number
  /** Re-sent once already after two misses. */
  isResent: boolean
  at: number
  deliveredAt: number
  ackedAt: number
  /** What the edit replaced (a title, a status, a choice), so it can be undone while queued. */
  before: string
}

export type Route = {
  version: number
  goal: string
  features: Feature[]
  steps: Step[]
  decisions: Decision[]
  edits: Edit[]
  /** The step the plane is on. */
  plane: string | null
  /** Claude's own words for what it is doing now. */
  doing: string
  /** When the plane last moved, for the flying pose. */
  movedAt: number
  setAt: number
  lastClaudeAt: number
  gate: 'waiting' | 'held' | 'go'
  isPaused: boolean
  landedAt: number
  addedAt: number
  addedCount: number
  nextEdit: number
  tests: { passed: number; failed: number; at: number; command: string } | null
  files: string[]
}

export type Live = {
  isRunning: boolean
  turnId: string
  turnStartedAt: number
  activity: string
  activityAt: number
  lastCommand: string
  waiting: { question: string; toolUseId: string } | null
  errorsInRow: number
  /** Failed test runs in a row on the step the plane is on. */
  failedRuns: number
  helpers: { id: string; description: string; isDone: boolean }[]
  celebrateUntil: number
  cost: number | null
  contextPercent: number | null
  heldTurnEnd: boolean
}

export type View = {
  open: string | null
  isDetailsOn: boolean
  isLegendOn: boolean
  countdown: number
  isCountdown: boolean
  armedStop: string | null
  isPlaced: boolean
  whereAnswer: string
  isSoundOn: boolean
}

declare module 'claude-code' {
  interface PluginState {
    flightplan: {
      route: Route | null
      live: Live
      view: View
    }
  }
}
