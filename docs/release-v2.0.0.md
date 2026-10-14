**Flight Plan 2.0, Pixel Skies.** The map beside the chat is now a tiny 8-bit airfield.

![In the air](https://raw.githubusercontent.com/aravinth01/flightplan/main/docs/sky-air.svg)

## Install or update

```
/plugin install flightplan --marketplace aravinth01/flightplan
```

Already on 1.0? Run `/plugin update flightplan@flightplan`, or reinstall with the line above.

## What's new

- **An animated pixel sky.**
  - Claude is the pixel captain of a chunky orange prop plane, and helpers are the pixel crew.
  - Every stop on the job is a pin on the route.
  - The sky runs from sunrise to sunset as steps actually close. It never moves on a guess, and the clock is
    never an ETA.
- **Big moments:**
  - take-off
  - glides between steps
  - a U-turn when you ask for a redo
  - a storm when tests keep failing
  - a "your turn" holding loop
  - landings
- **Honest landings.**
  - Confetti, a cheering crew and the fanfare happen only when every step has **receipts**: a test the map
    saw pass.
  - Otherwise the plane lands quietly and tells you how many steps still have no receipts.
- **Boarding passes.** The stop Claude is on opens as a boarding pass (from → to, its steps, a chip on each).
  The other stops fold into one-line stubs.
- **Words.** A light gen-z voice by default ("receipts ✅", "bumpy air", "taking five"), or plain words: set
  **Words** to `plain` in `/config`. What Claude reads is identical in both.
- **8-bit sounds.**
- **Animations.** Set it to `calm` for text marks with no animation.

## Under the hood

- The sky is one small SVG (about 9 KB), redrawn only when something real happens. Otherwise the same picture
  keeps running.
- In the desktop app the picture is sized in exact pixels, which keeps the pixel art crisp.
- Claude's `route` tool contract is byte-identical to 1.0, so nothing changes for Claude.
- Tests: 164.
