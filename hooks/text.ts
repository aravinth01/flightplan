// Every string the map writes on its own, in one place, in plain words.

import { basename } from './model'

const GLOSSES: [RegExp, string][] = [
  [/\b(node\s+--test|npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|bun\s+test|jest|vitest|mocha)\b/, 'runs the automatic checks'],
  [/\b(pytest|python3?\s+-m\s+(pytest|unittest)|go\s+test|cargo\s+test)\b/, 'runs the automatic checks'],
  [/\btsc\b/, 'checks the code compiles'],
  [/\beslint\b/, 'checks code style'],
  [/\b(npm|pnpm|yarn)\s+(run\s+)?build\b/, 'builds the app'],
  [/\b(npm|pnpm|yarn)\s+(install|add|i)\b|\bpip3?\s+install\b/, 'adds a library'],
  [/\bgit\s+commit\b/, 'saves a checkpoint'],
  [/\bgit\s+(status|diff|log)\b/, 'looks at what changed'],
  [/\b(ls|find|cat|head|tail|grep|rg)\b/, 'looks around the files'],
  [/\b(node|python3?|deno|bun)\s+\S+/, 'runs the program'],
]

export function gloss(command: string): string {
  for (const [pattern, words] of GLOSSES) if (pattern.test(command)) return words

  return 'runs a command'
}

export function activityFor(tool: string, file: string | undefined, command: string | undefined, description: string | undefined): string {
  if ((tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') && file !== undefined) return `editing ${basename(file)}`
  if (tool === 'Bash' && command !== undefined) return description !== undefined && description.trim() !== '' ? lower(description.trim()) : gloss(command)
  if (tool === 'Read' && file !== undefined) return `reading ${basename(file)}`
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob' || tool === 'LS' || tool === 'LSP') return 'looking around the code'
  if (tool === 'WebFetch' || tool === 'WebSearch') return 'looking something up'
  if (tool === 'Agent' || tool === 'Task') return 'sending a helper'
  if (tool === 'AskUserQuestion') return 'asking you something'
  if (tool === 'mcp__flightplan__route') return 'updating the map'

  return `using ${tool.replace(/^mcp__[^_]+__/, '')}`
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

export function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

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
