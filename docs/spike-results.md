# Flight Plan — Phase 0 spike results

Claude Code 2.1.295, Claude desktop app (macOS), Opus 5.5. Headless runs used `claude -p` with a probe mod
loaded by `--plugin-dir`. Ten task runs and two channel runs cost about $3.30 in all.

## Verdict

**Go, with one design change.** Claude reliably *declares* the plan but does not reliably *report* progress
through it. Position is therefore driven by evidence the mod observes (writes to each step's declared files,
test runs), with Claude's own `step` calls accepted as claims on top. The plane still never moves on a guess.

## 1. Model compliance (go/no-go item)

Five tasks of 2–6 planned steps (a greeter, a to-do module, a signup page, a Markdown converter, a persisted
to-do app), each run twice.

| Measure | v1: tool description only | v2: + prompt note + result nudges |
| --- | --- | --- |
| `set` called before the first edit | 5/5 | 5/5 |
| Writes made while a step was in progress | 18/18 | 10/17 |
| `step` calls per run | 1 (always just "start s1") | 2–5 |
| Route fully closed at the end | 0/5 | 1/5 |
| User edit acknowledged (`acks: ["e1"]`) | — (never delivered) | 2/3 |

**How Opus 5.5 works:** it plans, writes every file in one burst of parallel tool calls, runs the tests,
then answers. Its natural "step boundaries" are much coarser than the plan's steps. A nudge on a write only
arrives after the burst. After the test-run nudge it usually closes only the last step.

**What does work:** the plan it declares matches what it does.

| Measure | Result |
| --- | --- |
| Observed writes that land on a file declared by a step | **35/35** |
| Steps that declare files (the rest are test-running steps) | 33/36 |
| Runs that touch steps in plan order | 9/10 |

An offline replay of all ten runs through an evidence tracker (`replay.py`) put the plane on the right step
after every write, and 29/36 steps ended in a state matching what happened. The seven misses:

- 4: the probe clipped long test commands, so the test run went unseen (the real mod sees the full command).
- 2: a README written after the last test run stayed "in progress" (fixed by an end-of-turn rule: a step
  whose files are all written becomes `done, not tested` when the turn ends).
- 1: a step whose only file was shared with an earlier step stayed pending (a shared file needs to count
  toward every step that declares it).

## 2. Delivery channels (nonce echo, headless)

| Channel | Result |
| --- | --- |
| Tool-result `context` (any tool, incl. the route tool) | ✅ read |
| `$.session.append` hidden user row, mid-turn | ✅ read |
| `prompt.submit` hook `context` | ✅ read |
| `tool.call` deny with "the user removed this step" | ✅ obeyed; skipped the file and told the user why |
| `prompt.compose` system-prompt section | ❌ bypassed |
| `classic.PostToolBatch` additionalContext | ❌ bypassed |
| `classic.Stop` block | ❌ bypassed |

The debug log names the cause: `flightplan: prompt.compose bypassed by cc-plugin-sec-default (tier user);
beneath runs`, and the same line for `classic.PostToolBatch` and `classic.Stop`. A built-in security plugin
at the prepend tier takes these events ahead of user-tier mods. Whether the same holds inside the desktop
session is recorded by the in-app spike (`facts.reached` in `flightplan-spike-log.json`).

## 3. Rendering (plugin test kit, desktop and terminal)

| Fact | Result |
| --- | --- |
| Pane tree with Svg gutter tiles validates on desktop; terminal branch validates | ✅ |
| `Button` containing `Svg` | ❌ refused at JSX build: "holds strings and Text, not <Svg>" |
| Two sibling Boxes with the same key | Draws; only the hover scope is lost |
| Sibling imports (`./probe`, `./sprites`) from the hooks module | ✅ load |
| Template-literal `tool.call` matcher | Validator cannot read it (`tool=?`); use a string literal |

## 4. Design changes adopted

1. **Position from evidence.** The plane moves forward on the first write to a later step's declared files
   (marked "seen working on"), and on Claude's `step` calls. It never moves backward past observed work.
   A step whose files are all written becomes `done, not tested`. A passing test run upgrades touched steps
   to `checked`, a failing one marks them `done? last test failed`.
2. **`files` and `check` become required** in `set`; they are what the evidence tracker reads.
3. **Instructions ride the prompt, not the system prompt.** A ~60-token Flight Plan note, plus the current
   map position, rides each user prompt as `prompt.submit` context. The tool description stays the static
   contract.
4. **Edits use the fast lane.** Pending user edits ride the *next tool result of any tool* as context, worded
   "finish what you are doing in this step, then apply", as well as the next route result. Acknowledgement
   stays the `acks` echo.
5. **No Stop block.** End-of-turn closing happens in `turn.complete`: anything still open is shown honestly
   ("Claude didn't close these") with [Ask Claude to update the map].
6. **`step` accepts several finishes at once** (`finish: string | string[]`), so "close everything this test
   run covers" is one call.
7. Writes to a removed step's files show as a warning on the map, and the deny gate (proven to work) blocks
   them once.

## 5. Still to verify in the desktop app

The in-app spike (`flightplan-spike` pane, needs hot reloading) covers pane placement and size, Svg row
height and SMIL animation, hover cards, sound, toast and `$.ui.log` visibility, hotkeys and Input focus,
`$.ui.scroll`, the band, the Spinner rewrite, the send-now and hidden-note round trips, `$.model.fork`, the
Client region, and whether the three bypassed events reach a mod in the desktop session.

## 6. v2 lab results (desktop app, 2026-10-14)

`/flight lab` drew test pictures in the real Claude desktop app (a 63-column docked pane). The person tapped
the first answers, then asked to go ahead without the rest; the open questions were settled by the engine's
documented behaviour and the safest choice.

| Check | Result | Decision |
| --- | --- | --- |
| S2 animation survives redraws (the go/no-go) | **Pass**: a byte-identical source kept its 10 s sweep through Text changes every second (A) and alt changes every second (B) | Full animated plan. Scene sources are memoized and byte-stable between real events. |
| S2 sibling appears/disappears above it (C, D) | not answered | Keep the sky in a keyed Box as the root's first child (R19) and v1's `''` placeholders. |
| S1 sizing | **Only explicit `width`/`height` props filled the pane** (way 4: `bodyColumns × 8 × 0.98` px). Markup width, viewBox-only and `width="100%"` did not. | `SIZING = 'explicit'`: px width from `bodyColumns`, an integer px-per-unit scale, viewBox sized to match (see `hooks/scene.ts`). A resize redraws with new props (the only restart). |
| Box widths | the validator refused `width="33.333…%"` (lab unit test) | No fractional percentages. Equal shares are `width={0} flexGrow={1}`; spacers are whole cells. |
| S3 crisp pixels, light/dark | not answered | `shape-rendering="crispEdges"` with an integer px-per-unit scale (no seams by construction). The banner carries its own colors and a keyline frame; no `prefers-color-scheme`. |
| S4 what the scrub keeps | not answered | Use none of `<use>`, `<pattern>`, `<clipPath>`, `<style>`, CSS `:hover`, `<text>`, `href`. `<title>` only for stop tooltips (harmless if stripped; alt says the same). |
| S5 animation vocabulary | not answered | Only what v1's plane already proved on desktop: `animate` (opacity, visibility, fill), `animateTransform` (translate, scale, rotate) with `values`/`keyTimes`/`keySplines`, `calcMode` discrete/linear/spline, `additive="sum"`, `begin` ≥ 0, `fill="freeze"`, `repeatCount`. No `animateMotion`, no `<set>`, no negative `begin` (cloud phase is a static `translate` on an outer group). |
| S7 signs under towers | not answered | Signs row = a whole-cell left spacer + N equal flex shares + right spacer, in a Box as wide as the banner. |
| S8 chips, emoji, Button with Text | trees validate (lab unit test) | Chips are `Text` with `backgroundColor` + `color="inverseText"`, drawn as siblings of Buttons. Emoji budget per R13. |
| S9 CPU | lab sampling measured the wrong app instance (the person runs a multi-profile copy) | Measured instead on the real scene in the browser pane of the same app (Phase 3). |
| S6 Client, S10 hover | cut (R18), optional | Plain Text clock; hover only as polish. |
