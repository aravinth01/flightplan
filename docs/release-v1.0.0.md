The first public release of **Flight Plan**: a live map of what Claude Code is doing, beside the chat.

## Install

In a Claude Code terminal session:

```
/plugin install flightplan --marketplace aravinth01/flightplan
```

## What it does

- Claude files each multi-step job as a route of waypoints and steps, before it edits anything.
- A plane sits on the step Claude is working on. It moves when the map sees Claude write that step's files,
  or when Claude reports progress; it never moves on a guess.
- Steps are marked **checked** only when the map saw a test pass after the work, and **done, not tested**
  otherwise. Nothing is celebrated that was not verified.
- Change any step or choice on the map. Your change lands at once and reaches Claude on its next move, with a
  badge: queued, sent, Claude has it.
- A departure countdown lets you review the route before Claude starts (Hold to take your time).
- Cards for every moment: ready for takeoff, now, your turn, turbulence, holding, landed.
- Sounds for checked steps, finished waypoints, questions for you and landing; `/flight` commands.

## How it decides where Claude is

In testing with Opus 5.5, Claude filed its plan before editing in every run, but rarely reported each step
on its own. So the map follows evidence: writes to each step's declared files and the test runs it sees,
with Claude's own reports on top. Details in `docs/spike-results.md`.

## Settings

Departure (countdown, go, auto), countdown seconds, sounds (all, important, off) and the plane (full, calm),
under Flight Plan in `/config`.
