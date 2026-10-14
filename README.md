# Flight Plan

A live map of what Claude is doing, beside the chat in the Claude desktop app. Claude files the job as a
route of waypoints and steps; a small plane sits on the step it is working on; you can change any step or
choice on the map, and Claude picks the change up on its very next move.

Built for people who build with Claude Code without reading every tool call.

## Install

In a Claude Code terminal session, type:

```
/plugin install flightplan --marketplace aravinth01/flightplan
```

Answer `y` to add the marketplace, then pick the user scope. From then on every new Claude Code session
(including the desktop app's Code tab) loads Flight Plan.

## What's new

- **1.0.0**: first public release. The live map, the departure countdown, click-to-change steps and choices,
  evidence-based progress (writes and test runs), honest "done, not tested" marks, sounds, `/flight`.

## Using it

Ask Claude for anything that takes a few steps. Before it edits a file, Claude files the route and the map
opens beside the chat:

- **READY FOR TAKEOFF**: the whole route, with a 30-second countdown. Click any step to rename, skip or
  remove it. Opening a step pauses the clock; **Hold, let me look** stops it; **Take off now** starts.
  Small jobs (three steps or fewer) and plans you approved in plan mode take off at once.
- **NOW**: what Claude is doing, in plain words, and the plane on the step. The plane moves when the map sees
  Claude write a step's files, or when Claude reports progress. **details** shows files and commands.
- **YOUR TURN**: Claude asked you something; answer in the chat. The plane circles and a soft knock plays.
- **TURBULENCE**: the tests failed three runs in a row; **Try another way** or **Skip this step**.
- **HOLDING**: Claude stopped with steps open; **Continue**, or **Ask Claude to update the map**.
- **LANDED**: every step is done. Steps marked **done, not tested** can be checked with one press.

Every change you make shows a badge until Claude confirms it: **queued**, then **sent to Claude**, then
**Claude has it**. Your wording, order and removals always win over Claude's.

`/flight` opens the map. `/flight go`, `/flight hold`, `/flight pause`, `/flight show`, `/flight details`
and `/flight sound off` do what they say.

### What the marks mean

| Mark | Meaning |
| --- | --- |
| `checked` / `tests passed` | a test run the map saw pass after the step's work |
| `done, not tested` | the work happened (or Claude says so), but no test covered it |
| `done? last test failed` | the last test run after this step failed |
| `<>` | a choice Claude made without asking you; press review to keep or switch it |
| `~ queued` | your change, not yet read by Claude |

## Settings

In the config menu (`/config`), under Flight Plan:

| Setting | Values | Default |
| --- | --- | --- |
| Departure | `countdown`, `go` (wait for Take off), `auto` (start at once) | `countdown` |
| Countdown seconds | any number from 5 | 30 |
| Sounds | `all`, `important` (the knock and landing only), `off` | `all` |
| Plane | `full` (animated), `calm` (text marks) | `full` |

## How it works

- Claude gets one tool, `route`, with five operations: `set` (file the route, each step naming the files it
  will touch and how it will be checked), `step` (report progress), `patch`, `decide`, `get`.
- The map does not rely on Claude reporting every step. In testing, Claude filed its plan before editing in
  every run, but rarely reported step boundaries on its own. So the plane follows evidence: writes to a
  step's declared files, and test runs the map sees pass or fail.
- Your changes reach Claude in the result of its next tool call, or with your next message when it is idle.
- A short note on each of your messages tells Claude the map is on. Nothing goes into the system prompt.

Design notes and test results: `docs/spec.html` and `docs/spike-results.md`.

## Developing

Clone the repo, then install it from your local folder, so your edits load after `/reload-plugins`:

```bash
git clone https://github.com/aravinth01/flightplan ~/Projects/flightplan
```

```bash
claude plugin marketplace add ~/Projects/flightplan
```

```bash
claude plugin install flightplan@flightplan --scope user
```

Check and test it:

```bash
claude plugin validate ~/Projects/flightplan
```

```bash
claude plugin test ~/Projects/flightplan
```

Set `FLIGHTPLAN_LOG=/path/to/file.json` to have the route written out after each turn.

## License

MIT, © 2026 Sree Aravinth V.
