// The route tool's contract: what Claude reads. Byte-stable constants (the
// prompt cache depends on it); live route state never goes in here.

export const ROUTE_TOOL = 'route'

export const ROUTE_DESCRIPTION = `Flight Plan is the user's live map of this task: a pane beside the chat that draws your plan as waypoints (features) with steps under each, and a plane on the step you are on. The user watches the map, not your tool calls, and changes nodes there; their changes reach you in tool results. Use it for any task with two or more steps, plan mode or not; never for one-off questions.

Wording first: write for someone who does not code. A title is the outcome in the user's words ("Let users log in with Google"), never a file, function or library name; why is one plain line. Paths go in files, commands in check.

Ops (field op):
- set: the whole plan before your first edit. Features in order, 1-6 steps each, at most 12 steps. Every step lists the files it will create or change and a check (the command that proves it, or what to look at). The map follows your writes to those files.
- step: report progress. finish takes one id or several (close everything a test run covered in one call) with outcome and evidence (the command you ran and what it showed, or "none"); start names the step you begin. Never claim a check you did not run.
- patch: add, drop, reword or reorder steps you have not started; say why in note.
- decide: any choice the user did not ask for (a library, a structure, a skipped or widened scope), with alternatives and a one-line why; keep going.
- get: re-read the route after compaction or when a result names changes you have not applied.

Results carry version and userEdits: steps the user renamed, removed, skipped or asked to redo, waypoints they added, decisions they switched. Finish what you are doing in the current step, then apply them before the next step (a removed step is not done; a switched decision means rework), echo their ids in acks, and pass version back as baseVersion. The user's wording, order and removals win.`

export const ROUTE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['op'],
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['set', 'step', 'patch', 'decide', 'get'] },
    baseVersion: { type: 'integer', description: 'The version from the last result you read.' },
    acks: { type: 'array', items: { type: 'string' }, description: 'Ids of userEdits you have read and applied.' },
    goal: { type: 'string', maxLength: 80, description: 'set: the whole task in one line, in the user\'s words.' },
    features: {
      type: 'array',
      maxItems: 8,
      description: 'set: the waypoints in order, each with its steps in the order you will do them.',
      items: {
        type: 'object',
        required: ['id', 'title', 'why', 'steps'],
        properties: {
          id: { type: 'string', description: 'Short stable id (f1).' },
          title: { type: 'string', maxLength: 60, description: 'The outcome the user gets, in their words.' },
          why: { type: 'string', maxLength: 100, description: 'One plain line: what this gives the user.' },
          steps: {
            type: 'array',
            maxItems: 6,
            items: {
              type: 'object',
              required: ['id', 'title', 'why', 'files', 'check'],
              properties: {
                id: { type: 'string', description: 'Short stable id (s3), unique across the route.' },
                title: { type: 'string', maxLength: 60, description: 'What will be true when it is done, in plain words.' },
                why: { type: 'string', maxLength: 100 },
                files: { type: 'array', items: { type: 'string' }, description: 'Paths this step creates or changes; [] only for a step that just runs a check.' },
                check: { type: 'string', maxLength: 80, description: 'The command that proves it (node --test), or what to look at.' },
              },
            },
          },
        },
      },
    },
    finish: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      description: 'step: the id, or ids, of steps you finished.',
    },
    outcome: { type: 'string', enum: ['done', 'skipped', 'blocked'], description: 'step: for finish; skipped and blocked need a note.' },
    evidence: { type: 'string', maxLength: 120, description: 'step, with done: the command you ran and what it showed, or exactly none.' },
    start: { type: 'string', description: 'step: the id of the step you begin now.' },
    doing: { type: 'string', maxLength: 60, description: 'step: what you are doing now, present tense, plain words.' },
    note: { type: 'string', maxLength: 120, description: 'One plain line for the user.' },
    add: {
      type: 'array',
      description: 'patch: new steps.',
      items: {
        type: 'object',
        required: ['id', 'feature', 'title', 'files', 'check'],
        properties: {
          id: { type: 'string' },
          feature: { type: 'string', description: 'Feature id; a new id plus featureTitle creates a waypoint.' },
          featureTitle: { type: 'string', maxLength: 60 },
          after: { type: 'string', description: 'Step id it goes after; omit for the end of its feature.' },
          title: { type: 'string', maxLength: 60 },
          why: { type: 'string', maxLength: 100 },
          files: { type: 'array', items: { type: 'string' } },
          check: { type: 'string', maxLength: 80 },
        },
      },
    },
    drop: { type: 'array', items: { type: 'string' }, description: 'patch: ids of steps you have not started.' },
    reword: {
      type: 'array',
      description: 'patch: new title, why, files or check for existing steps.',
      items: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string', maxLength: 60 },
          why: { type: 'string', maxLength: 100 },
          files: { type: 'array', items: { type: 'string' } },
          check: { type: 'string', maxLength: 80 },
        },
      },
    },
    order: { type: 'array', items: { type: 'string' }, description: 'patch: the new order of steps not yet started.' },
    id: { type: 'string', description: 'decide: decision id (d1); reuse it to update.' },
    question: { type: 'string', maxLength: 80, description: 'decide: what had to be chosen, plain words.' },
    choice: { type: 'string', maxLength: 60, description: 'decide: plain words first, technical name in parentheses.' },
    alternatives: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 60 } },
    why: { type: 'string', maxLength: 100, description: 'decide: one plain reason.' },
    affects: { type: 'array', items: { type: 'string' }, description: 'decide: ids of steps that depend on this choice.' },
  },
}
