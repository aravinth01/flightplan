# Flight Plan v2 "Pixel Skies": design

Written by a four-part design pass (art director, copywriter, engine engineer, critic) on 2026-10-13.
Where sections disagree, **the critic's resolutions (§4) win**; the approved plan summarises them.

## 1. Art and scenes

### concept

PIXEL SKIES is a tiny 8-bit airfield that lives in the pane. Claude is the captain of a chunky orange prop plane (the same Claude orange as v1's plane, now drawn in pixels). Your job is the flight, each feature is a waypoint pin on the route, and each step is a seat on that waypoint's boarding pass.

A flight has a story arc:
- You board at the gate before sunrise (5:45 AM, the countdown) and take off at 6:00 AM.
- The sky brightens through morning and noon only as steps actually get done. The clock is "sky time" that moves with finished work. It is never a real clock and never an ETA.
- When Claude needs you, the plane circles with a "?" bubble and the captain waves from a little cockpit cam.
- When tests keep failing, a pixel storm rolls in.
- When everything has receipts, the plane touches down at sunset with runway lights, cheering crew and confetti.

Helpers become nameless pixel crew. They parachute down to do side jobs and wave when they're back.

From munderdiffl.in we take the attitude, not the layout: warm cream plus dark ink plus one orange accent, chunky pixel characters, a clock that walks through a day, uppercase mono labels, terminal-card chrome with traffic-light dots, and short friendly status chips ("on it", "receipts ✅").

What's ours: it's a sky instead of an office, it's the live state of your own job, and the fun never lies:
- a RECEIPTS stamp only for a test the map saw pass
- fireworks only when every step of a waypoint has receipts
- confetti only when the whole route lands with receipts on everything

### palette

FIXED INK AND ACCENTS (every scene, inside the Svg)
- ink #2B1D16 (outlines and pixel text)
- cream #FFF4E0 (tags, contrail, bubbles)
- Claude orange #D97757 (plane, the accent word, the current pin); orange shade #B5563A
- glass #9ED8F0; white #FFFFFF
- success green #2E9E5B; mint #7FD39B (done, not tested); amber #F2A93B (bumpy air, failing); red #D64545 (beacons); gold #F2B13C (sparkles, board frame)
- captain: navy #23395B, skin #E9B48A
- ground kit: tower cream #EFE6D2; tower grey #8C8A93; asphalt #55555F; runway paint #F4F1EA; runway light #FFD54F; board #1B1B22; board text #F2A93B
- weather: storm #4B5563 / #374151; rain #9FB4D9; lightning #FFE45C; flash #FFFFFF at 25%
- confetti: #D97757 #2E9E5B #F2B13C #4FA3E3 #E85D9E
- crew outfits:
  - ramp crew: hat #F7D046, vest #FF8A1F, pants #3E4A5C, skin #F2C29B
  - cabin crew: hat and top #2F8F8A, bottom #23395B, skin #C68A5E, scarf #F2B13C
  - mechanic: cap and overalls #3E6FB0, pants #2B3A55, skin #8D5A3B, wrench #8C8A93

SKY BY TIME OF DAY
Each row: 4 sky bands top -> horizon | cloud / cloud shade | ground / hills | sun.
- night: #0B1530 #13224A #1E3263 #2C4377 | #3A4A6B / #2A3756 | #1D2B2A / #16211F | moon #F4EBC8, stars #FFF6D5
- predawn (before 6:00): #1E2A55 #3B3F7A #7A5A8C #E59A7A | #C9B6D6 / #9C86B5 | #33463A / #2A3A30 | #FFB27A
- dawn (6:00-7:59): #3E5BA9 #7C7FC0 #F3A98B #FFD29A | #FFE9E0 / #E8B7B0 | #4E7A4B / #3F6740 | #FFB347
- morning (8:00-10:59): #4FA3E3 #7CC0EE #A9D8F5 #D9F0FB | #FFFFFF / #D6E8F5 | #6DBE6A / #57A457 | #FFD54F
- noon (11:00-13:59): #2F8FE0 #56A9EC #86C5F3 #C3E5FA | #FFFFFF / #CFE3F3 | #66B85A / #4F9C49 | #FFF07A
- afternoon (14:00-16:29): #3D86D1 #6AA6DE #A7C9E8 #F2E3C2 | #FFFDF5 / #E6DCC8 | #79B35A / #62994A | #FFC94A
- golden hour (16:30-17:59): #4A6FB8 #E39B6B #F7B267 #FFD9A0 | #FFE3C2 / #E9A47A | #8A9A4E / #6F7F3E | #FF9F3F
- dusk (18:00 on, and every landing): #2E3A75 #7B4B8E #E46F6A #F8A65B | #F6B6A8 / #B9768A | #3F5A44 / #314836 | #FF7A3D (half sunk behind the hills)

SKY TIME (progress -> clock -> palette)
- p = (closed live steps + 0.5 if the plane's step is active) / live steps. Clamp it to 0..0.98 in the air; it is 1 only on landing.
- Day flight: minutes = 360 + 2*round(p*360), which runs from 6:00 AM to 6:00 PM, snapped to even minutes and shown as "h:mm AM". Fixed times:
  - on the ground: 5:30 AM
  - boarding: 5:45 AM
  - landed: 6:48 PM
- Red-eye flight (seasonal): 10:00 PM -> 6:00 AM, landing at 6:12 AM into the dawn palette.
- Your turn, holding, paused and turbulence never move the clock. Turbulence lays the storm over the current palette.
- When the route grows, the clock goes back (honest), with a "+N NEW" tag under it.
- Never seconds, never an ETA. The Svg <title> says: "Sky time: the day moves as steps get done. Not a real clock."

LIGHT AND DARK APP THEMES
- The banner is its own framed card and carries all its colors (the Svg cannot read the theme).
- Frame: pixel-rounded corners (2-step stair) and two keylines drawn as filled rings, no strokes:
  - outer 1u cream #FFF4E0 at 35%: reads on dark themes
  - inner 1u ink #2B1D16: reads on light themes
- Every word inside the Svg is pixel font: ink on a cream tag, or cream on ink for the current pin and the pause screen. Contrast is 7:1 or better on any sky.
- Everything outside the Svg (deck card, boarding passes, chips) uses only theme keys: claude, success, warning, error, planMode, permission, subtle, inactive. No hex, so it follows light and dark by itself.
- Chips are Text inverse plus a theme color, which draws a filled pill in either theme.
- One-accent-word rule (from the reference): each card has exactly one bold word in claude (or warning/success when the state calls for it). Everything else is default or dim.

### sceneSpec

THE BANNER: ONE PASSIVE SVG AT THE TOP OF THE PANE
- JSX: <Box key='scene' flexShrink={0} marginBottom={1}><Svg source={sceneSvg(key)} alt={sceneAlt} isInteractive /></Box>
- Pass no width or height props. The markup says width='{W*10}' height='{H*10}' viewBox='0 0 W H' shape-rendering='crispEdges'. The engine takes the markup's width up to the slot, so the banner fills the slot, and draws the height at that width, so it scales evenly at about 1.8-2 px per pixel unit.
- Width bracket from bodyColumns:
  - under 46 columns: W=160
  - 46-69 columns: W=240
  - 70 or more: W=300
- Height:
  - H=72 when placement is 'dock'
  - H=36 strip when placement is 'inline' or compact (sky, route, plane and clock tag only; no ground, crew or labels)
- If the spike shows the auto-size fails, fall back to width={bodyColumns*8} and height={round(width*H/W)}.
- The gutter plane in the step row is a second, tiny Svg: viewBox 0 0 28 15, width={22} height={12}, isInteractive (prop spin and bob only). Never more than these 2 Svgs per pane. The deck card no longer carries a plane Svg while the banner is shown.
- Calm mode draws the same pictures with zero SMIL. The 'text' fun setting draws no Svg at all (the v1 glyph path, also used by the terminal).

COORDINATES AND VERTICAL ZONES (H=72, integer units only)
- 0-12: HUD band
  - clock tag at (3,3): 9u tall cream tag with a 1u ink ring and a 7x7 sun or moon icon, then pixel text "10:42 AM · CRUISING". The state word is the accent color: orange normally, amber for BUMPY AIR, green for TOUCHDOWN.
  - right side of the band: departure board, pause screen title, landed badge.
- 13-19: waypoint label tags.
- 22-37: pins. Pin tips touch the route.
- route altitude: 34 + [0,-3,2,-2,3,-1,1,-3][i] at pin i.
- plane: anchor pixel (13,7) of the sprite sits on the route point.
- 42-52: near clouds. 6-20: far clouds.
- 52-58: hills. 58-71: ground strip with towers, runways and crew.

ROUTE GEOMETRY (computed in TS; pure function of route + W)
- X0 = 56 (W>=240) or 48 (W=160): top of climb. X1 = W-48 or W-40: start of descent.
- Polyline points:
  - G = (26,50): gate, plane parked, gear down
  - R0 = (X0-12, 50): end of the takeoff roll
  - P1..PN: one pin per live feature. A pin marks the START of that waypoint's leg; the leg after it holds the feature's steps.
  - E = (X1, yN)
  - T = (X1+16, 50): touchdown
  - S = (W-28, 50): stop
- Pin x is proportional to the steps before it: x_i = X0 + (stepsBefore_i/total)*(X1-X0), with a minimum gap of 16u (push right, then clamp from X1 back). If N cannot fit, space evenly and hide labels.
- Plane spot for step j of n on leg i: (j+0.5)/n along P_i -> P_(i+1) (or E for the last leg).
- t = arc length from G / total length. This is the keyPoints value.
- Towers sit at x 2-10 and W-12..W-4. Runways run [14, X0-8] and [X1+8, W-16] at y 58-60.

LAYERS, BOTTOM TO TOP, AND HOW EACH MOVES (SMIL only)
1. Sky: 4 band rects (0-16, 16-32, 32-46, 46-58) plus 3 dither strips (2u tall, url(#d1..d3), 2x2 checker of the lower band's color) at y 15, 31 and 45. Inside the move window, when the bucket changed, each band gets <animate attributeName='fill' from='OLD' to='NEW' dur='1.2s' fill='freeze'/>.
2. Sun or moon: <g transform='translate(sx sy)'> with sx = 10 + p*(W-20) and sy = 50 - round(sin(p*pi)*36). The ray set swaps every 2s: two paths, discrete visibility. In the move window, an animateTransform translate goes from the old to the new point over 1.2s, freeze.
3. Far clouds: 3 small clouds at 85% opacity, laid in [0,W] and duplicated at +W.
   <animateTransform attributeName='transform' type='translate' from='0 0' to='-W 0' dur='{W/2}s' begin='-{phase}s' repeatCount='indefinite'/> (2u/s).
4. Near clouds: 2 big clouds, the same trick at dur W/4 s (4u/s). Speed is halved in holding and your-turn. In paused there is no animate, just a static translate(-phase).
5. Ground: base rect, stepped hills path (heights 2,4,6,5,3,2,3,5,6,4 x 6u wide, repeating), runways, towers. Tower beacon: 1px red, values='1;1;0' 2s. At night: 6 city-light pixels twinkling, 3s, staggered.
6. Route: two paths of dots sampled every 4u from R0 to E.
   - before the plane: cream 3x1 "contrail" trail at 90%
   - after the plane: ink 2x1 at 45%
7. Pins: <g transform='translate(x-3 y-9)'><title>{feature title} · {k} of {n} steps done</title>…</g>.
   - Current pin: center pixel blinks (1.2s) and a red beacon pixel sits 2u above.
   - Checked pin: gold 3x3 sparkle twinkles (2s).
   - Label tags (cream, 7u tall, pixel font) above every pin when the minimum gap is 30u or more; otherwise only the current pin's tag. The current tag is inverted (ink background, cream text).
8. Crew: up to 3, plus a "+N" pixel tag (see crew).
9. Plane: <g> with either transform='translate(X Y)' or, inside the move window, this (no static transform):
   <animateMotion dur='1.4s' fill='freeze' calcMode='spline' keyTimes='0;1' keyPoints='{t0};{t1}' keySplines='.25 .1 .25 1' path='{full route d}'/>
   Inside it:
   - bob <g>: <animateTransform type='translate' calcMode='discrete' values='0 0;0 -1;0 0;0 1' dur='1.6s' repeatCount='indefinite'/>
   - sprite at translate(-13 -7): body path set, 3 prop paths (discrete visibility rotation, 0.24s), captain head pixels in the window, 3 contrail puffs (opacity .9 -> 0, 0.9s, begins 0 / .3 / .6s)
   - gear group only on the ground
   - backward moves add a discrete scale(-1 1) flip at 0 and back at 1.4s
10. FX: stamp, fireworks, confetti, storm, rain, lightning and flash, darken overlay.
11. HUD: clock tag, "+N NEW" tag, departure board, pause title, cockpit-cam inset, landed badge.
12. Frame keylines, as filled ring paths.

SKELETON
<svg xmlns='http://www.w3.org/2000/svg' width='2400' height='720' viewBox='0 0 240 72' shape-rendering='crispEdges'>
<title>Sky time…</title>
<defs>
  <clipPath id='c'><path d='M2 0H238V1H239V2H240V70H239V71H238V72H2V71H1V70H0V2H1V1H2Z'/></clipPath>
  <pattern id='d1' width='2' height='2' patternUnits='userSpaceOnUse'>…</pattern>
  …
</defs>
<g clip-path='url(#c)'>…layers 1-11…</g>
…keylines…
</svg>

BYTE STABILITY (the most important engineering rule)
- sceneKey(route, live, view, now, columns, config) returns a plain object with NO timestamps, seconds, countdown numbers or "ago" text. Fields:
  - W, H, mode, sky, skyFrom? (move window only), clock, word (voice applied)
  - sunP (rounded to 0.01)
  - pins[{x, y, state, tag, title}]
  - planeT (rounded to 0.005), planeFromT? (move window only)
  - crew[{variant, phase: drop | work | back}], extraCrew
  - oneShot? with its pin index
  - landing (party | quiet | amber), growTag (number or 0)
  - season, calm
- sceneSvg memoizes on JSON.stringify(key) in a 24-entry LRU. Same key, same string, so redraws (activity text, countdown seconds) hand the frame a byte-identical source.
- Cloud phase is baked only on a cache miss: phase = (now/1000*speed) mod W. Drift therefore looks continuous across real scene changes.
- One-shots join the key only inside their window. Whoever records the event (never the render hook) calls $.clock.after(window+50, () => $.ui.invalidate('ui.render')) so the next draw drops it. This is the v1 pattern of the 'flying' pose plus the 1600 ms invalidate.
- New state fields:
  - live: stampAt / stampFeature, fireworksAt / fireworksFeature, toolSince, helpers[].at / doneAt
  - route: planeFrom, takeoffAt, crewUsed

BUDGETS
- Measured sprite paths after run-merge: plane 712 chars, captain 491, crew frame 331, tower 475, pin 357, big cloud 147, small cloud 104, sun 159, storm 147.
- Estimated scene size: cruise about 12 KB; landed party (confetti 24 pieces, 3 crew, captain, stamp) about 22 KB.
- Hard cap 32 KB, enforced by a unit test that renders every mode x 3 widths x 2 voices x seasons and asserts length <= 32768, no 'NaN' and no 'undefined'.
- Element caps: <= 150 path/rect, <= 40 animate/animateTransform/animateMotion/set, 0 <text> (every word is pixel font, so there is no font dependency), <= 3 <pattern>, 1 <clipPath>, <= 12 <title>.

SPIKE CHECKS BEFORE BUILDING (desktop app)
1. A byte-identical source keeps SMIL running across redraws. If it restarts instead: put the cloud phase, quantized to 1s, into the key, so sources change at most once a second and every restart lands on the right phase.
2. Negative begin offsets work. If not: bake the phase as a static translate(-phase) on an outer group and loop the inner group from 0.
3. With no width prop, a 2400-wide markup fills the slot and the height scales.
4. clipPath, pattern and <title> survive the scrub.
5. Text inverse plus color draws as a filled chip on desktop.

ALT TEXT
Always plain words, whatever the voice setting. Example: "Flight Plan sky, 10:42 AM: cruising on waypoint 2 of 4 (Let people log in with Google), step 2 of 3. 1 waypoint done."

### stateScenes

Each state lists: the sky and clock word, what moves (loops), what plays once on entry, the card words in gen-z / plain voice, and the sound. "Window" is how long a one-shot stays in the scene key.

ON THE GROUND (card 'empty')
- Sky: predawn, 5:30 AM. Word: ON THE GROUND.
- Scene:
  - plane parked at the gate, gear down, prop still (frame A)
  - captain standing beside it holding a coffee mug
  - a faint dotted line (ink 25%) runs to a pixel signpost in the middle reading "WHERE TO?"
- Loops: tower beacon (2s), steam pixel (1.5s), clouds at 1u/s.
- One-shot: none.
- Card:
  - gen-z: "no flight plan yet. tell Claude what we're building, and once it's more than one step the route pops up here ✈️"
  - plain: the v1 COPY.empty
- Sound: none.

BOARDING (card 'ready', gate waiting or held)
- Sky: predawn, 5:45 AM. Word: BOARDING (held: ON HOLD).
- Scene:
  - plane at the gate with a jet bridge attached; captain at the bridge door
  - full route preview, all pins pending with labels, so you can read the trip before it starts
  - HUD-right departure board: ink with a gold frame, pixel text "GATE 1 · {N} STOPS" and a 2x2 amber lamp
  - the countdown digits are never in the Svg (they live in the card Text)
- Loops: lamp blink (1.0s on / 0.4s off).
- Entry one-shot (window 1.0s): board letters flip in 60ms apart, the jet bridge slides out 6u (0.5s), the captain waves 3 times.
- Held: board steady, lamp off, captain idle.
- Card:
  - gen-z: "boarding now 🎟 wheels up in 23 s. tap any step to change it first."
  - plain: "Ready for takeoff, starting in 23 s. Click any step to change it first."
  - held, gen-z: "on hold ✋ take your time. hit Take off when it looks right."
  - held, plain: the v1 holdHint
- TAKEOFF one-shot (gate -> go, window 2.6s):
  - jet bridge retracts (0.3s)
  - the plane rolls along the runway (keyPoints 0 -> t(R0), 0.8s, ease-in) and kicks up 3 cream dust pixels
  - pitch -6° (animateTransform rotate) for 0.6s while climbing to step 1's spot (t(R0) -> t1, 1.3s)
  - the gear hides at 1.1s (set visibility)
  - the sky tweens predawn -> dawn (1.2s)
- Sound: none.

CRUISING (card 'now', pose cruise or flying)
- Sky: from p. Word: CRUISING (both voices).
- Scene:
  - plane on its step's spot with prop spin, bob and contrail
  - the done part of the route is a cream trail; the rest is ink dots
  - current pin beacon, two-layer cloud parallax, sun on its arc
- Entry one-shot GLIDE (route.movedAt within 1.6s): animateMotion t0 -> t1 over 1.4s with an ease-out spline, plus a sky and sun tween if the bucket changed.
- U-TURN: a backward move (redo, failed) flips the plane left, glides it back, and flips it right at the end. Chip: gen-z "going back to fix it" / plain "back to this step".
- Card:
  - gen-z: "we're **cruising** · {doing}"
  - plain: "**Now:** {doing}"
  - activity row: "✻ {activity} · 4s ago"
  - chip: ON IT / IN PROGRESS

THINKING (running, no tool activity for 5s or more)
- Word: gen-z COOKING / plain THINKING.
- Scene: cruising plus an 11x7 cream thought bubble above the cockpit. Its 3 dots light in turn (0.9s).
- Card: gen-z "let it cook. Claude's thinking" / plain "Claude is thinking".
- LONG HAUL variant (one tool call running more than 20s, tracked by live.toolSince):
  - the bubble shows a 5x7 hourglass that flips 180° every 1.5s (discrete)
  - word: STILL ON IT / STILL WORKING
  - card: "still on it, {activity} is taking a sec" / "Still working: {activity}"
- No one-shot.

YOUR TURN (card 'ask')
- Word: gen-z YOUR CALL / plain YOUR TURN.
- Scene:
  - holding pattern: the plane flies a 28x10 racetrack around its spot, 4s per lap. The sprite flips at half lap, so it never flies upside down.
  - a 9x9 "?" bubble bobs above the plane
  - a cockpit-cam inset (16x17, bottom-left) shows the captain waving
  - the sky is dimmed 12% so the bubble pops; clouds run at half speed
- Entry one-shot (window 1.0s): bubble pop (scale 0 -> 1.2 -> 1 over 0.3s), captain waves 3 times.
- Loop: a slow wave every 4s.
- Card:
  - gen-z: "your **turn** 👀 Claude needs a quick answer:" then the question in quotes, then "we're circling till you answer in the chat."
  - plain: "**Your turn**: Claude asked you something." then the question, then the v1 hint
  - button: [Show me]
- Sound: knock.

TURBULENCE (card 'turbulence': 3 or more failed test runs in a row on this step)
- Word: gen-z BUMPY AIR / plain TURBULENCE, in amber.
- Scene:
  - 20x6 slate storm cloud above the plane
  - 6 rain drops (0.5s loop)
  - lightning bolt plus a 25% white flash, twice per 2.6s
  - plane wobble: discrete ±1u jitter, 0.4s
  - sky darkened 25%; near clouds turn slate
- At pose turbulence (2 failures) only a small storm cloud shows, no lightning ("light chop"). This keeps v1's pose and card split.
- Entry one-shot: the storm slides in from the right (0.8s).
- Card:
  - gen-z: "bumpy **air**, not gonna lie: the tests failed {n} runs in a row on “{step}”. it usually sorts itself out, or you can nudge it."
  - plain: the v1 turbulence copy
  - buttons: [Try another way] [Skip this step]

HOLDING (card 'holding': the turn ended with steps still open)
- Word: gen-z CIRCLING / plain HOLDING.
- Scene: a slow 6s racetrack, no bubble, half-speed clouds, prop on.
- One-shot: none.
- Card:
  - gen-z: "we're **circling** at “{step}”. reply in the chat or hit Continue"
  - plain: v1
  - with unclosed steps, both voices add "Claude stopped with 2 steps not closed on the map"

PAUSED (card 'paused')
- Word: PAUSED.
- Scene: a game pause screen.
  - the plane sits at its spot with the prop stopped; clouds are static at the baked phase
  - an ink overlay at 35%
  - centered cream pixel text "II PAUSED", the only thing blinking (1.2s)
- One-shot: none.
- Card: gen-z "**paused**, no stress. hit Continue when you're ready." / plain "**Paused** after “{step}”."

LANDED (card 'landed'). Three honest variants.

(a) PARTY: every live step checked or skipped, and the last test run is green.
- Sky: dusk, 6:48 PM. Word: TOUCHDOWN, in green.
- Entry one-shot (window 6s):
  - the plane descends along the route (t -> t(T), 2.2s)
  - touchdown bounce: 2u translate at 2.2-2.5s
  - it rolls to S (0.5s) while the prop winds down (frames slow from 0.24s to 0.6s, then stop)
  - at 2.6s: 24 confetti pieces fall (1.6-2.6s each)
  - captain and the crew used on this flight pop out by the tower and cheer 4 times
  - a "RECEIPTS ✓" stamp slams onto HUD-right and stays as a static badge
- After the window: runway edge lights chase forever (1.2s, 0.15s stagger); the captain blinks every 4s.
- Card:
  - gen-z: "touchdown, we **ate** 🎉 every step has receipts."
  - plain: "**Landed**. Every step is checked."
  - chip: WE ATE ✓ / ALL CHECKED
- Sound: fanfare.

(b) QUIET: some steps are done but not tested, or only Claude says they're done.
- Word: LANDED.
- The same landing, with no confetti, no stamp and no cheering. Runway lights stay steady. The captain holds a clipboard ("paperwork pending").
- Card:
  - gen-z: "**landed**, but {n} steps have no receipts yet." [Ask Claude to check]
  - plain: "**Landed**. {n} steps are done but not tested."
- Sound: chime, not fanfare.

(c) AMBER: the last test run failed.
- Word: LANDED, in amber.
- Runway lights amber and steady; an amber "!" sign by the tower; no confetti.
- Card:
  - gen-z: "landed, but {n} tests still fail. not celebrating that one yet."
  - plain: "Landed with {n} failing tests."
- Sound: none.

ONE-SHOT CELEBRATIONS

RECEIPTS STAMP (window 2.5s)
- Trigger: a step becomes 'checked' because the map saw a test pass, or Claude's evidence names a run the map saw pass.
- The stamp is a green double-bordered "RECEIPTS ✓" (plain: "TESTED ✓"), 47x13. It slams onto that waypoint's pin:
  - scale 2.4 -> 1 and opacity 0 -> 1 in 0.18s, tilted -10°
  - 2u scene shake for 0.15s
  - holds until 1.8s, then fades over 0.4s
- In the list, that step's chip shows inverse success "RECEIPTS ✅" for the same 2.5s.
- Sound: tick.
- "I checked it" (you) gets no stamp, only the chip "you vouched ✓".

WAYPOINT FIREWORKS (window 2.2s)
- Trigger: every live step of a feature is checked. If the stamp also fires, this starts 0.5s after it.
- Two rockets rise from behind the pin (0.4s) and burst through 3 frames (0.6s): one orange + gold, one teal + pink.
- The pin flips to the checked green flag with a gold sparkle.
- Sound: chime.

ROUTE GREW (60s tag)
- The sun slides back to the earlier sky time (1.2s) and an amber "+2 NEW" tag hangs under the clock tag. The bar says why, as in v1.

CREW DROP / BACK
- See the crew section.

### sprites

LEGEND (character -> color)
- . transparent
- K ink #2B1D16
- O orange #D97757; o orange shade #B5563A
- C cream #FFF4E0; W glass #9ED8F0; w glint #FFFFFF; F white #FFFFFF
- N navy #23395B; S captain skin #E9B48A
- Y gold #F2B13C; G green #2E9E5B; g mint #7FD39B; A amber #F2A93B; R red #D64545
- M grey #8C8A93; L light #C9C2B8; X storm #4B5563; x storm shade #374151
- p prop blur #8C7F75 at 55%; r terracotta #C2603F
- Crew slots (per variant): h hat, t top, b bottom, s skin
- Sprite-local overrides:
  - clouds: F = cloud, c = cloud shade (by time of day)
  - tower: C = #EFE6D2
  - runway: M = #55555F, F = #F4F1EA
  - sun: Y = sun color
  - moon: L = #F4EBC8
  - bolt: Y = #FFE45C
  - pumpkin: A = #F28C28

PLANE, 26x13, nose right
Anchor pixel (13,7) sits on the route point. This is also the gutter mini plane, drawn at 22x12 px.
.KKK......................
.KOOK.....................
.KOOOK....................
.KOOOOKKKKKKKKKKKKKK......
KOOOOOOOOOOOOOOOOOOOKK....
KOOOOOOOOOOOOOOOKWWWOOK...
KOOOCOOCOOCOOOOOKWwWOOOK..
KCCCCCCCCCCCCCCCCCCCCCCCKK
KoooooooooooooooooooooooK.
.KKoooooKKKKKKKKKoooooKK..
...KKKKKKoooooooKKKKKK....
........KoooooooK.........
.........KKKKKKK..........
- Propeller, x=25 (row 7 is the hub, already in the body). Three frames swapped by discrete visibility, 0.08s each:
  - A: rows 2-6 and 8-12 ink
  - B: rows 5-6 and 8-9 ink
  - C: rows 2-12 blur p
  - Parked, paused and landed use A, static.
- Captain in the cockpit (in flight): (18,5) and (19,5) N for the cap; (18,6) and (19,6) S for the face.
- Gear (rows 13-14, ground only):
...K.......K..............
..KMK.....KMK.............
- Contrail: cream 2x1 puffs at (-3,7), (-7,8) and (-11,7).

CAPTAIN (Claude), 10x14
Frames: idle (blink: eye pixels K -> S for 0.15s every 4s) and wave.
idle:
...NNNN...
..NNONNN..
.KKKKKKKK.
...SSSS...
...SKSK...
...SSSS...
..NNFFNN..
.NNNFYNNN.
SNNNFFNNNS
.NNNNNNNN.
..NNNNNN..
..NN..NN..
..NN..NN..
.KKK..KKK.
wave (right arm up):
...NNNN..S
..NNONNN.S
.KKKKKKKKN
...SSSS..N
...SKSK.NN
...SSSS.N.
..NNFFNNN.
.NNNFYNNN.
SNNNFFNNN.
.NNNNNNNN.
..NNNNNN..
..NN..NN..
..NN..NN..
.KKK..KKK.
- The O on the cap is the orange Claude badge.
- Cockpit-cam portrait: rows 0-8 of either frame, inside a 16x17 cream panel with a 1u ink ring.
- Props: mug 3x3 (FFK / FFK / FF.) with a steam pixel blinking above; clipboard 3x4 (KMK / CCC / CKC / CCC).

CREW TEMPLATE, 8x13, three frames, recolored per variant
stand:
........
..hhhh..
.hhhhhhh
..ssss..
..sKsK..
..ssss..
.tttttt.
stttttts
.tttttt.
..bbbb..
..b..b..
..b..b..
.KK..KK.
walk:
........
..hhhh..
.hhhhhhh
..ssss..
..sKsK..
..ssss..
.tttttt.
.ttttttt
.stttts.
..bbbb..
.bb..bb.
.b....b.
KK....KK
cheer:
s......s
t.hhhh.t
thhhhhht
t.ssss.t
t.sKsK.t
t.sKKs.t
.tttttt.
.tttttt.
.tttttt.
..bbbb..
.bb..bb.
.K....K.
........
Variants (no names; picked by dispatch order mod 3):
- 0 ramp crew: hard hat #F7D046, hi-vis #FF8A1F, pants #3E4A5C, skin #F2C29B, plus cream reflective pixels at (2,7) and (5,7)
- 1 cabin crew: teal #2F8F8A hat and top, #23395B bottom, skin #C68A5E, plus a gold scarf at (3,6) and (4,6)
- 2 mechanic: #3E6FB0 cap and overalls, #2B3A55 pants, skin #8D5A3B, plus a grey wrench at (7,5) and (7,6)

PARACHUTE, 9x6
..OCOCO..
.OCOCOCO.
OCOCOCOCO
K...K...K
.K..K..K.
..K.K.K..

CLOUDS
big, 16x6:
.....FFFF.......
...FFFFFFFF.FF..
..FFFFFFFFFFFFF.
FFFFFFFFFFFFFFFF
cccccccccccccccc
.cccccccccccccc.
small, 10x4:
...FFF....
.FFFFFFFF.
FFFFFFFFFF
.cccccccc.
storm, 20x6:
......XXXX..........
...XXXXXXXXX.XXX....
..XXXXXXXXXXXXXXXX..
XXXXXXXXXXXXXXXXXXXX
xxxxxxxxxxxxxxxxxxxx
.xxxxxxxxxxxxxxxxxx.

PINS, 7x9 (stem tip at (3,8))
pending:
..KKK..
.KCCCK.
KCCCCCK
KCCKCCK
KCCCCCK
.KCCCK.
..KCK..
...K...
...K...
- current: the pending grid with C -> O and the center -> F (blinks), plus a red beacon pixel at (3,-2).
done (check mark):
..KKK..
.KGGGK.
KGGGGFK
KGGGFGK
KFGFGGK
.KFGGK.
..KGK..
...K...
...K...
- done, not tested: the done grid with G -> g (mint), no sparkle.
- checked: the done grid plus a gold 3x3 sparkle (.Y. / YFY / .Y.) at (5,-2).
failed:
..KKK..
.KAAAK.
KAAKAAK
KAAKAAK
KAAAAAK
.KAKAK.
..KAK..
...K...
...K...
- yours (proposed, not planned yet): the pending grid with C -> #A78BFA and a dashed stem (rows 7-8 alternate).

GROUND KIT
tower, 9x13 (red beacon at (4,-1)):
...KKK...
..KWWWK..
.KWWwWWK.
KKKKKKKKK
.KCCCCCK.
..KCCCK..
..KCMCK..
..KCCCK..
..KCMCK..
..KCCCK..
..KCCCK..
.KCCCCCK.
KKKKKKKKK
runway tile, 16x3 (edge lights: 1x1 #FFD54F at row -1, every 4u):
MMMMMMMMMMMMMMMM
MMFFFFMMMMFFFFMM
MMMMMMMMMMMMMMMM
jet bridge, 12x5 (L grey body):
KKKKKKKKKKKK
KLLLLLLLLLLK
KLWLLWLLWLLK
KLLLLLLLLLLK
KKKKKKKKKKKK
- departure board: an ink #1B1B22 rect with a 1u gold ring, amber pixel text and a 2x2 lamp.

SKY KIT
sun, 9x9 (body = center rows 2-6; rays = the 8 single pixels, split into an orthogonal set and a diagonal set that swap every 2s):
....Y....
.Y.....Y.
...YYY...
..YYYYY..
Y.YYYYY.Y
..YYYYY..
...YYY...
.Y.....Y.
....Y....
moon, 7x7:
..LLL..
.LLL...
LLL....
LLL....
LLL....
.LLL...
..LLL..
- star: 3x3 plus (.F. / FYF / .F.) or 1x1 F.

WEATHER AND FX
bolt, 5x8:
..YYY
.YYY.
.YY..
YYYYY
..YF.
.YY..
.Y...
Y....
- rain: 1x2 #9FB4D9.
- confetti pieces: 2x2, 1x3 and 3x1 in the 5 confetti colors. A discrete swap between 1x3 and 3x1 every 0.2s fakes tumbling.
fireworks, 9x9, three frames (A = burst color, a = 50% burst color):
f1:
.........
.........
.........
....A....
...AFA...
....A....
.........
.........
.........
f2:
.........
....A....
..A...A..
.........
.A..F..A.
.........
..A...A..
....A....
.........
f3:
....a....
.a.....a.
.........
.........
a.......a
.........
.........
.a.....a.
....a....
- RECEIPTS stamp: built from the font, not a grid. Text "RECEIPTS ✓" is 41u wide (plain "TESTED ✓"). Two 1u G rings: outer at text+8 x 13, inner inset 2u. Text in G at (4,4).

BUBBLES
thought, 11x7 (the 3 dots at x 2, 5 and 8 blink in turn):
.KKKKKKKKK.
KCCCCCCCCCK
KCKCCKCCKCK
KCCCCCCCCCK
.KKKKKKKKK.
..KCK......
...K.......
question, 9x9:
.KKKKKKK.
KCCCCCCCK
KCCKKCCCK
KCCCCKCCK
KCCCKCCCK
KCCCCCCCK
KCCCKCCCK
.KKKKKKK.
...KK....
hourglass, 5x7:
KKKKK
KYYYK
.KYK.
..K..
.K.K.
KYYYK
KKKKK

SEASONAL
pumpkin, 5x5 (g stem):
..g..
.AAA.
AKAKA
AAAAA
.AKA.
bat, 7x3, up frame:
K.....K
KK.K.KK
..KKK..
bat, down frame:
..K.K..
.KKKKK.
K.....K
diya, 5x4 (flame frames: Y, then #FF9F3F with an extra pixel at (2,-1)):
..Y..
.rrr.
rrrrr
.rrr.
lantern, 3x5:
.K.
OOO
OYO
OOO
.Y.
party hat, 4x4 (on the tail fin at (1,-4)):
...F
..RY
.RYR
RYRY
- witch hat, 7x4: ...K... / ..KKK.. / .KOOOK. / KKKKKKK
- ghost, 8x10 (replaces the ramp crew outfit): ..FFFF.. / .FFFFFF. / .FKFFKF. / .FFFFFF. / FFFFFFFF x4 / F.FF.FF. / ........
- snow: 1x1 F.

PIXEL FONT, 3x5 (M, N and W wider; advance = glyph width + 1; space = 2 columns)
A .#./#.#/###/#.#/#.#    B ##./#.#/##./#.#/##.    C .##/#../#../#../.##
D ##./#.#/#.#/#.#/##.    E ###/#../##./#../###    F ###/#../##./#../#..
G .##/#../#.#/#.#/.##    H #.#/#.#/###/#.#/#.#    I ###/.#./.#./.#./###
J ..#/..#/..#/#.#/.#.    K #.#/#.#/##./#.#/#.#    L #../#../#../#../###
M #...#/##.##/#.#.#/#...#/#...#    N #..#/##.#/#.##/#..#/#..#
O .#./#.#/#.#/#.#/.#.    P ##./#.#/##./#../#..    Q .#./#.#/#.#/##./.##
R ##./#.#/##./#.#/#.#    S .##/#../.#./..#/##.    T ###/.#./.#./.#./.#.
U #.#/#.#/#.#/#.#/###    V #.#/#.#/#.#/#.#/.#.    W #...#/#...#/#.#.#/##.##/#...#
X #.#/#.#/.#./#.#/#.#    Y #.#/#.#/.#./.#./.#.    Z ###/..#/.#./#../###
0 ###/#.#/#.#/#.#/###    1 .#./##./.#./.#./###    2 ##./..#/.#./#../###
3 ##./..#/.#./..#/##.    4 #.#/#.#/###/..#/..#    5 ###/#../##./..#/##.
6 .##/#../###/#.#/###    7 ###/..#/.#./.#./.#.    8 ###/#.#/###/#.#/###
9 ###/#.#/###/..#/##.
:  ./#/./#/.     .  ././././#     ·  ././#/./.     !  #/#/#/./#
'  #/#/././.     ?  ##./..#/.#./.../.#.            -  .../.../###/.../...
+  .../.#./###/.#./...                              /  ..#/..#/.#./#../#..
▸  #../##./###/##./#..                              ✓  ....#/...#./#.#../.#.../.....
Measured widths: "10:42 AM · CRUISING" = 72u, "RECEIPTS ✓" = 41u, "BUMPY AIR" = 37u.
Waypoint tags are sanitized to A-Z, 0-9 and space, at most 7 characters; titles with none of those get "STOP n".

CONVERSION TO SVG (done once at module load; scenes only concatenate)
1. For each grid, scan rows into horizontal runs per character.
2. Merge a run into the rect directly above it when x and width match and that rect ends on this row.
3. Write one <path fill='#hex' d='M{x} {y}h{w}v{h}h-{w}z…'/> per color per sprite.
4. Place sprites with <g transform='translate(x y)'>, integer coordinates only. The root sets shape-rendering='crispEdges'. No strokes anywhere: outlines are ink pixels and rings are filled paths.

function toPaths(grid: string[], pal: Record<string, string>): string {
  const by = new Map<string, number[][]>()
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x]
      if (c === '.') { x++; continue }
      let e = x
      while (row[e] === c) e++
      const list = by.get(c) ?? []
      const up = list.find(r => r[0] === x && r[2] === e - x && r[1] + r[3] === y)
      if (up) up[3]++
      else list.push([x, y, e - x, 1])
      by.set(c, list)
      x = e
    }
  })
  return [...by].map(([c, rs]) => `<path fill='${pal[c]}' d='${rs.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('')}'/>`).join('')
}

- Frame swaps are sibling paths with <animate attributeName='visibility' calcMode='discrete' values='visible;hidden;hidden' …/>, with the values list rotated per frame.
- Palette slots (crew h/t/b/s, cloud F/c, sun Y) are swapped by passing a different pal. The run geometry is cached per grid.

### boardingPass

EACH WAYPOINT IS A BOARDING PASS (Box, Text and Button only)

EXPANDED PASS
When: the plane is on this waypoint, you opened it, a step failed, or it's the first one during boarding. These are v1's isExpanded rules.

<Box key={`wp-${id}`} flexDirection='column' borderStyle={proposedByYou ? 'dashed' : 'round'} borderColor={passColor} paddingX={1} hover={{ borderColor: 'claude' }}>
  row 1: <Box row justifyContent='space-between'>
           <Text bold>🎟 BOARDING PASS</Text>
           <Text dimColor>WAYPOINT 2 OF 4</Text>
         </Box>
  row 2: <Box row justifyContent='space-between' flexWrap='wrap' columnGap={1}>
           <Text dimColor>FROM IDEA  ✈  TO LOGIN</Text>
           <Box row gap={1}>
             <Text dimColor>STEP 2 OF 3</Text>
             <Text inverse bold color={chipColor}> ON IT </Text>
           </Box>
         </Box>
  row 3: <Button key={`fb-${id}`} plain onPress={open}><Text bold>{feature.title}</Text></Button>
  row 4: perforation: <Text dimColor>{'┄'.repeat(bodyColumns - 4)}</Text>
  step rows, then badges and editors exactly as in v1
</Box>

- FROM is the previous waypoint's tag ("GATE" for the first); TO is this waypoint's tag. Tags are the same words the Svg pins show.
- passColor:
  - plane here: claude
  - every step checked: success
  - a step failed: warning
  - proposed by you: planMode
  - opened but pending: subtle
  - removed: inactive

Pass chip, gen-z / plain:
- plane here: ON IT / IN PROGRESS (claude)
- next waypoint: UP NEXT / NEXT (planMode)
- later: LATER (subtle)
- all checked: STAMPED ✓ / ALL CHECKED (success)
- done, untested: NO RECEIPTS YET / NOT TESTED (subtle)
- failed: TEST SAID NOPE / TEST FAILED (warning)
- proposed by you: YOUR IDEA / PROPOSED BY YOU (planMode)
- removed: CUT / REMOVED (inactive)

STEP ROWS INSIDE A PASS (keys unchanged from v1, so the tests keep pressing sb-…)

<Box key={`s-${id}`} row>
  <Text dimColor>{isLast ? '└─ ' : '├─ '}</Text>
  <Box key={`g-${id}`} width={3} flexShrink={0}>
    {isPlane && svgOn
      ? <Svg source={MINI_PLANE[pose]} alt='The plane: Claude is here' width={22} height={12} isInteractive/>
      : <Text color={glyphColor}>{glyph}</Text>}
  </Box>
  <Box key={`c-${id}`} column flexGrow={1} flexShrink={1}>
    <Box row justifyContent='space-between' columnGap={1} flexWrap='wrap'>
      <Button key={`sb-${id}`} plain onPress={open}>{title}</Button>
      <Text color={chipColor} dimColor={!chipColor} inverse={isStampFlash}>{chip}</Text>
    </Box>
    plane step only: why line (dim italic), then crew rows "⛑ crew · {task}" + chip (max 3, then "+2 more crew on it")
  </Box>
</Box>

- The Svg is always a sibling of the Button, never inside it.

Glyphs:
- checked: ✓ (success)
- done, untested: ✓ (dim)
- failed: ! (warning)
- pending: ○ (dim)
- skipped: – (dim)
- blocked: # (warning)
- removed: × (dim), with a strikethrough title

Step chips, gen-z / plain:
- plane: cruising… / working on it
- active, plane not here: started
- next pending: up next / next
- checked by a test: receipts ✅ / tested ✓ (success)
- checked by you: you vouched ✓ / you checked it
- done, untested: done, no receipts yet / done, not tested
- Claude says done: Claude says done / done, Claude says
- failed: test said nope / last test failed (warning)
- skipped by you: skipped, your call / skipped by you
- blocked: stuck / blocked
- removed by you: cut by you / removed by you
- dropped by Claude: dropped by Claude
- isStampFlash: for 2.5s after a test check, the chip draws inverse success "RECEIPTS ✅". This is the list's only motion.

COLLAPSED PASS = TICKET STUB (one row, no border, saves height)

<Box key={`f-${id}`} row justifyContent='space-between'>
  <Box row gap={1}>
    <Text color={glyphColor}>{glyph}</Text>
    <Button key={`fb-${id}`} plain>{`${n} · ${title}`}</Button>
  </Box>
  <Text dimColor>{dotLeader + chip}</Text>
</Box>

- dotLeader is '·' repeated to fill: bodyColumns - widths. The title truncates first.
- Hovering the keyed row underlines the title (Text hover).
- During boarding only, stubs also show v1's dim italic why line.
- Done stubs read "✓ 1 · Sketch the idea ···· STAMPED ✓" in success, or "NO RECEIPTS YET" in dim.

OTHER ROWS
- Decisions stay as v1 rows "<> Claude chose X · review" (warning when flagged). Gen-z: "Claude picked X without asking · review".
- Landing row: "⚑ landing: every step has receipts" / "⚑ Landing: everything checked".

DECK CARD (replaces v1's state card)
- Round border in the state color (claude, planMode, permission, warning, subtle, success).
- Row 1: traffic dots (Text error ●, warning ●, success ●), then the TAG in bold caps on the left; the chip on the right.
- Row 2: headline with one bold accent word.
- Row 3: "✻ activity · 4s ago" (dim).
- Then buttons, exactly as in v1.

MID-FLIGHT, 58 COLUMNS (the ╔═╗ block is the Svg banner; ▐ ▌ marks inverse chips)
╔════════════════════════════════════════════════════════╗
║▐☀ 10:42 AM · CRUISING▌    ░░░            ☼             ║
║  ░░░░     IDEA        LOGIN        TESTS     SHIP      ║
║            ✔           ◉             ○         ○       ║
║   ╱━━━━━━━━●━━━━━━━━━━━●━━━✈· · · · ●· · · · · ●· · ╲  ║
║ ▲      ░░░░░                 ░░░░            ░░     ▲  ║
║▄█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄▄║
╚════════════════════════════════════════════════════════╝
Ship Google sign-in for the app             step 3 of 7
▰▰▰▱▱▱▱ 2 done · ~5 left          4 files · 11 tests pass
╭────────────────────────────────────────────────────────╮
│ ● ● ●  FLIGHT DECK                             ▐ON IT▌ │
│ ✈  we're cruising — wiring up the Google reply         │
│ ✻ editing auth/callback.ts · 4s ago                    │
│ [Pause after this step] [Add a feature] [Where are we?]│
╰────────────────────────────────────────────────────────╯
────────────────────────── route ─────────────────────────
✓ 1 · Sketch the idea ························ STAMPED ✓
╭────────────────────────────────────────────────────────╮
│ 🎟 BOARDING PASS                    WAYPOINT 2 OF 4     │
│ FROM IDEA  ✈  TO LOGIN       STEP 2 OF 3   ▐ON IT▌     │
│ Let people log in with Google                          │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ ├─ ✓  Add the Google button           receipts ✅      │
│ ├─ ✈  Handle the reply                cruising…        │
│ │     so the app knows who just signed in              │
│ │     ⛑ crew · reading the old login code     on it    │
│ └─ ○  Remember who is logged in       up next          │
╰────────────────────────────────────────────────────────╯
<> Claude chose Supabase for logins ·············· review
○ 3 · Prove it works ··························· 2 steps
○ 4 · Ship it ··································· 1 step
⚑ landing: every step has receipts
──────────────────────────────────────────────────────────
6 min in the air                         details · legend

MID-FLIGHT, 40 COLUMNS (W=160 banner; with pins this close only the current tag shows)
╔══════════════════════════════════════╗
║▐☀ 10:42 AM · CRUISING▌        ☼      ║
║   ░░░           LOGIN       ░░       ║
║         ✔         ◉        ○    ○    ║
║  ╱━━━━━━●━━━━━━━━━●━━✈· · ·●· · ●· ╲ ║
║ ▲    ░░░░              ░░░        ▲  ║
║▄█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄▄║
╚══════════════════════════════════════╝
Ship Google sign-in          step 3 of 7
▰▰▰▱▱▱▱ 2 done · ~5 left
╭──────────────────────────────────────╮
│ ● ● ●  FLIGHT DECK           ▐ON IT▌ │
│ ✈ we're cruising — wiring up the     │
│   Google reply                       │
│ ✻ editing callback.ts · 4s ago       │
│ [Pause after this step]              │
│ [Add a feature] [Where are we?]      │
╰──────────────────────────────────────╯
──────────────── route ─────────────────
✓ 1 · Sketch the idea ······ STAMPED ✓
╭──────────────────────────────────────╮
│ 🎟 BOARDING PASS · WAYPOINT 2 OF 4    │
│ IDEA ✈ LOGIN · STEP 2 OF 3   ▐ON IT▌ │
│ Let people log in with Google        │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ ├─ ✓ Add the Google button           │
│ │    receipts ✅                     │
│ ├─ ✈ Handle the reply      cruising… │
│ │    ⛑ crew · reading old code on it │
│ └─ ○ Remember who is logged in       │
╰──────────────────────────────────────╯
<> Claude chose Supabase ······· review
○ 3 · Prove it works ·········· 2 steps
○ 4 · Ship it ·················· 1 step
⚑ landing: every step has receipts
────────────────────────────────────────
6 min in the air        details · legend

BOARDING (58)
╔════════════════════════════════════════════════════════╗
║▐☾ 5:45 AM · BOARDING▌               ▐GATE 1 · 4 STOPS ●▌║
║    ░░░             ░░░              ·                  ║
║          IDEA     LOGIN     TESTS   SHIP               ║
║            ○ · · · · ○ · · · · ○ · · ○ · · · ╲         ║
║ ▲ ╔╗═══✈        ⚇                              ▲       ║
║▄█▄╚╝▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄▄▄▄▄▄▄║
╚════════════════════════════════════════════════════════╝
Ship Google sign-in for the app          ready for takeoff
╭────────────────────────────────────────────────────────╮
│ ● ● ●  GATE 1                              ▐BOARDING▌  │
│ 🎟 boarding now — wheels up in 23 s                     │
│ 7 steps · 4 waypoints. Tap any step to change it first.│
│ [Take off now]  [Hold, let me look]                    │
╰────────────────────────────────────────────────────────╯
╭ pass 1 expanded, with ○ steps and chips "up next" / "" ╮
○ 2 · Let people log in with Google ············ 3 steps
│  so people don't need another password

YOUR TURN (58)
╔════════════════════════════════════════════════════════╗
║▐☀ 11:20 AM · YOUR CALL▌                     ☼          ║
║   ░░░             ┌─┐    ░░░                           ║
║          ✔        │?│                                  ║
║  ╱━━━━━━━●━━━━━━━(✈ ↺)━ · · · ○ · · · · ○ · · · ╲      ║
║┌────┐▐YOUR CALL?▌    ░░░░                        ▲     ║
║│ ⚇/ │▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄▄▄▄║
╚════════════════════════════════════════════════════════╝
╭────────────────────────────────────────────────────────╮
│ ● ● ●  YOUR TURN                          ▐YOUR CALL▌  │
│ 👀 Claude needs a quick answer from you:               │
│ “Google only, or Google and GitHub too?”               │
│ We're circling till you answer in the chat.            │
│ [Show me]                                              │
╰────────────────────────────────────────────────────────╯

TURBULENCE (58)
╔════════════════════════════════════════════════════════╗
║▐☀ 11:58 AM · BUMPY AIR▌            ▓▓▓▓▓▓▓             ║
║   ░░░             ░░░            ▓▓▓▓▓▓▓▓▓▓ ϟ          ║
║          ✔          ◉            ╎ ╎  ╎ ╎              ║
║  ╱━━━━━━━●━━━━━━━━━━●━━━━━━━━━━━ ✈≈ · · · ○ · · · ╲    ║
║ ▲     ░░░░                   ░░░                 ▲     ║
║▄█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄▄▄▄▄║
╚════════════════════════════════════════════════════════╝
╭────────────────────────────────────────────────────────╮
│ ● ● ●  TURBULENCE                        ▐BUMPY AIR▌   │
│ bumpy air, not gonna lie: the tests failed 3 runs in a │
│ row on “Handle the reply”. It usually sorts itself     │
│ out, or you can nudge it.                              │
│ [Try another way]  [Skip this step]                    │
╰────────────────────────────────────────────────────────╯
(the pass shows "! Handle the reply   test said nope" in warning)

LANDED, PARTY (58)
╔════════════════════════════════════════════════════════╗
║▐◒ 6:48 PM · TOUCHDOWN▌   ✦  ·   ✺   ·  ✦  ▐RECEIPTS ✓▌ ║
║  ░░░     ▪ ▫   ▪   ▫  ▪    ▫  ▪   ▫    ▪               ║
║        ✔         ✔         ✔        ✔                  ║
║  ╱━━━━━●━━━━━━━━━●━━━━━━━━━●━━━━━━━━●━━━━━╲            ║
║ ▲                          *⚇* *⚇* *⚇* ⚇/  ✈       ▲   ║
║▄█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄∙▄∙▄∙▄∙▄∙▄∙▄∙▄▄▄▄▄█▄▄▄▄║
╚════════════════════════════════════════════════════════╝
╭────────────────────────────────────────────────────────╮
│ ● ● ●  LANDED                            ▐WE ATE ✓▌    │
│ 🎉 touchdown, we ate — every step has receipts.        │
│ 7 steps · 6 files · 14 tests pass · 18 min in the air  │
╰────────────────────────────────────────────────────────╯
✓ 1 · Sketch the idea ························ STAMPED ✓
✓ 2 · Let people log in with Google ·········· STAMPED ✓
✓ 3 · Prove it works ························· STAMPED ✓
✓ 4 · Ship it ································ STAMPED ✓

LANDED, QUIET (deck card only)
│ ● ● ●  LANDED                         ▐NO RECEIPTS▌    │
│ landed — but 2 steps have no receipts yet.             │
│ [Ask Claude to check]                                  │
- In the banner: no confetti, steady lights, captain with a clipboard.

### crew

THE CAPTAIN IS CLAUDE (never given another name; alt text says "the captain (Claude)")

In flight: a 2x2 captain (navy cap over a skin pixel) sits in the plane's cockpit window in every flying scene. A glance tells you "Claude is at the controls".

On the ground, a full 10x14 captain stands on the apron, feet at y=58, 16u right of the plane:
- On the ground (empty): holds a coffee mug; a steam pixel blinks every 1.5s; blinks every 4s.
- Boarding: stands at the jet-bridge door and waves 3 times on entry (0.4s per frame). Idle while held.
- Landed party: steps out beside the tower and waves 4 times with the crew, then idles with a blink.
- Landed quiet: holds a clipboard ("paperwork pending" means untested steps). No wave.
- Landed amber: stands next to the "!" sign. No wave.

Your turn: the cockpit-cam inset (16x17 cream panel, bottom-left of the sky) shows the captain's head and shoulders.
- Waves 3 times on entry, then one slow wave every 4s.
- Speech bubble in pixel font: "YOUR CALL?" (gen-z) / "YOUR TURN" (plain).
- This is the only time the captain talks.

Turbulence: the cockpit pixels shake with the plane. Nothing extra; the storm is the story.

THE CREW ARE HELPERS (subagents): nameless, no personalities
- Who: one crew member per helper dispatched this turn (Agent or Task tool calls by the main conversation).
- Variant = dispatch order mod 3:
  - ramp crew: yellow hard hat, hi-vis vest
  - cabin crew: teal
  - mechanic: denim, with a wrench
- Skin tones differ per variant. Faces are 2 eye pixels. Never a name, never a role title in words.
- How many: at most 3 drawn. More shows as a pixel "+N" tag next to the third.
- Where: on the ground strip under the current waypoint's leg. Slot x = clamp(pinX + 8 + i*11, 20, W-30), feet on y=58. Slots are stable per leg, so crew don't jump on every step.

ENTERING (helper starts; window 1.6s)
- The crew member parachutes from the plane's current position to their slot: animateMotion on a straight path, 1.2s ease-out, with the 9x6 orange/cream canopy above.
- At 1.2s the canopy hides (set visibility hidden) and they start working.

WORKING (loop while the helper runs)
- Stand and walk frames alternate every 0.4s ("busy feet").
- A 1px tool glint blinks at the hand: the mechanic's wrench, the ramp crew's wand light, the cabin crew's clipboard tick.

BACK (helper finished; window 1.2s)
- A 2u hop and 2 cheer frames, then they stand idle.
- No check mark: a helper coming back is not verified work, so it is not celebrated as such.

LEAVING
- Crew clear at turn end with the helper list (v1 already empties it).
- No exit animation: the next scene simply doesn't draw them.

LANDING
- route.crewUsed (capped at 3) counts the helpers dispatched across the flight.
- On a party landing they line up beside the destination tower with the captain: cheer and stand frames every 0.3s, 4 times, then stand, under the confetti.
- On quiet and amber landings they stand idle beside the tower.
- With no helpers on the flight, the captain celebrates alone.

STATUS CHIPS IN THE LIST (Text, under the plane's step, max 3 rows + "+2 more crew on it")
- Row: "⛑ crew · {the helper's own task description, lowercased, cut to 40 characters}"
- Chip, gen-z / plain:
  - running: "on it" (claude) / "working" (claude)
  - finished: "back" (success, dim) / "finished" (success, dim)
- The scene shows which variant; the text never invents names.

### seasonal

All seasonal touches are optional and decoration only. They never change the honesty rules and never add a celebration.

RULES
- Dates only: no network.
- Decided once at route set and kept for the whole flight.
- At most one season at a time (New Year > Halloween > Diwali > Winter). Red-eye can stack with any of them.
- Each adds at most 1.5 KB and 2 loops.
- In calm mode they are drawn static.
- Setting: "seasonal: on | off", default on.

RED-EYE FLIGHTS (route filed between 10:00 PM and 4:59 AM local)
- Sky time maps 10:00 PM -> 6:00 AM, with the moon on the arc.
- 8 stars twinkle (3s, staggered); 6 city-light pixels twinkle on the hills.
- Landing comes at sunrise, 6:12 AM, into the dawn palette with a gold horizon.
- Cost: about 1 KB, 1 loop.

HALLOWEEN (Oct 24-31; v2 likely ships right into it)
- Pumpkin bunting: a 1u ink string sagging across the top of the sky with a 5x5 pumpkin every 28u, swaying ±1u over 3s.
- 2 bats cross every 40s (7x3 sprite, 2-frame flap at 0.3s).
- The captain's cap becomes a 7x4 witch hat; the ramp crew wears an 8x10 ghost sheet.
- The clock tag icon becomes a pumpkin.
- Party-landing copy: "touchdown 🎃 all treats, no tricks".

DIWALI (5-day window around 2026-11-08, 2027-10-29, 2028-10-17; extend the table yearly)
- A row of diyas along the ground strip every 20u (5x4 terracotta, flame flickers in 2 frames at 0.4s).
- 2 sky lanterns drift slowly upward (3x5, 30s loop).
- Waypoint fireworks (still only on receipts) use gold and pink.
- Party-landing copy: "touchdown ✨ happy Diwali".

WINTER (Dec 1 - Jan 6)
- 14 snow pixels fall (6-9s loops, staggered begins).
- A 2u white snow cap tops the ground strip and both tower roofs.
- Cost: about 0.8 KB.

NEW YEAR (Dec 31 6:00 PM - Jan 1 end of day)
- A party landing adds 3 extra bursts.
- The landed clock word becomes "HAPPY NEW YEAR" in pixel font.
- Waypoint fireworks still need receipts.

THE PLANE'S BIRTHDAY (anniversary of the first route ever filed; $.store key "firstFlightAt", one date only)
- A 4x4 striped party hat sits on the tail fin all day.
- Landed copy: "touchdown. also, it's the plane's birthday 🎂".
- This is a date, not a score: no counts, streaks or levels anywhere (the spec bans them).

FRIDAY AFTER 4 PM (local)
- Text only: the party-landing copy gets "weekend loading." Nothing changes in the Svg.

### motionRules

1. LOOPS THAT MAY RUN FOREVER (only these)
- Prop spin: 3 frames, 0.24s. Only while flying.
- Bob: 4 discrete steps, 1.6s.
- Contrail puffs: 0.9s.
- Cloud drift: far 2u/s, near 4u/s. Half speed in holding and your turn; stopped in paused.
- Current-pin beacon: 1.2s.
- Sun rays: 4s.
- Tower beacon: 2s, ground scenes only.
- Exactly ONE state loop:
  - thinking dots 0.9s, or hourglass flip 3s
  - your-turn lap 4s, or holding lap 6s
  - rain 0.5s + lightning per 2.6s
  - pause blink 1.2s
  - runway chase 1.2s
  - board lamp 1.4s
- Crew working frames: 0.4s, at most 3 crew.
- At most 1 seasonal loop (2 for Halloween), plus stars at night.

2. ONE-SHOTS
Each plays once, ends with fill='freeze', and lives in the scene key only inside its window (milliseconds):
- glide / U-turn / sky shift: 1600
- takeoff: 2600
- receipts stamp: 2500
- waypoint fireworks: 2200 (starts 500 ms after a stamp)
- crew drop: 1600
- crew back: 1200
- your-turn pop: 1000
- board flip: 1000
- storm slide-in: 1000
- landing: 6000 (party) / 3000 (quiet, amber)
- "+N NEW" tag: 60000 (static)
The hook that records the event schedules one $.clock.after(window+50) invalidate so the next draw drops it.

3. AT MOST ONE HERO AT A TIME
- Landing beats everything: no stamp or fireworks inside the landing window; the party covers them.
- Stamp and fireworks from the same test run are choreographed (stamp at 0s, fireworks at 0.5s) rather than stacked.
- A glide that lands while a stamp is up still plays; it is part of the scene, not a hero.
- No more than 2 things blink at once.
- One-shots never cover the clock tag. The current pin's label is covered only by its own stamp, for at most 2.5s.

4. SPEED AND SAFETY
- No sprite frame shorter than 0.08s, and only the prop is that fast.
- Blinks at 2 Hz or slower.
- Lightning: at most 2 flashes per 2.6s, white overlay at 25% opacity or less. That stays under 3 flashes a second (photosensitivity).
- Shake is at most 2u for 0.15s.
- Pixel art moves in whole units wherever it can (calcMode='discrete' for bob, wobble and frame swaps).

5. CALM MODE (fun: 'calm', static frames)
- The same scene builder with calm=true: zero <animate*>/<set>, no one-shots.
- The plane sits at its final spot, clouds at the baked phase, the prop on frame A.
- Checked pins show their sparkle statically.
- fun: 'text' draws no Svg at all (v1's glyph path, also used on the terminal).
- The list's 2.5s inverse "receipts" chip stays in calm (it's a color, not motion).

6. HONESTY, NEVER BROKEN
- The plane moves only when route.movedAt changes: a write the map saw, or Claude's own step report. Glides never guess.
- Sky time and the sun come only from closed steps. They never tick between events, never show seconds or an ETA, and go BACK when the route grows (with the "+N NEW" tag saying why).
- RECEIPTS stamp: only for 'checked' that came from a test run the map saw pass.
- Waypoint fireworks: only when every live step of that feature is checked.
- Confetti, cheering and fanfare: only on a party landing (every live step checked or skipped, last run green). A quiet landing gets a chime and a clipboard; a failing landing gets nothing to celebrate.
- "I checked it" (you) and "Claude says done" never get a stamp, only their own chips.
- Helpers coming back wave; they don't get a check mark.
- No points, streaks, levels or speed scores, in any season.

7. BYTE STABILITY AND COST
- Nothing time-based is ever in the Svg source: no countdown digits, no "4s ago", no Date.
- Same key -> same memoized string, so the engine can keep the frame running.
- The cloud phase is baked only on a cache miss.
- No new $.clock.every for animation; SMIL does all motion. The only redraws are v1's 5s tick while running plus one invalidate at the end of each one-shot window.
- At most 2 Svgs per pane (banner + gutter plane). Source 32 KB or less (test-enforced; about 12 KB typical).

8. SOUND PAIRS WITH VERIFIED MOMENTS ONLY
- tick = stamp
- chime = waypoint fireworks, or a quiet landing
- knock = your turn
- fanfare = party landing only (a change from v1, which played it on any landing)
- v1's 2s limiter and mute switch stay.

9. THE LIST STAYS STILL
- Box/Text never animate except the 2.5s receipts chip flash.
- Hover states (border to claude, title underline) are the only other change.
- All the fun lives in the banner, so reading and clicking the route is never fighting motion.

## 2. Words

### principles

WHO WE WRITE FOR
Two readers at once: a 60-year-old who has never coded, and a 16-year-old who notices anything cringe. A line ships only if the 60-year-old gets it on the first read and the 16-year-old wouldn't roll their eyes. Both are glancing at it mid-task, so the important word goes first.

THE TWO VOICES
- fun (default): light gen-z on top of plain English. The airport words do most of the work (boarding, wheels up, cruising, bumpy air, holding pattern, touchdown, captain, crew), and a small fixed set of slang adds the wink. Contractions are welcome. "We" means you and Claude flying together.
- plain: the same facts in friendly everyday words, with no slang and no emoji. v1's copy is the plain baseline. Plain only changes v1 where it used jargon (compiles, library, waypoint, feature, toggled) or was unclear.
- Both voices have the same facts, the same order and the same numbers. Switching voice never changes what a line claims.

THE DELETE TEST
Every fun line must stay true and clear with its slang removed ("Not gonna lie, it's bumpy" becomes "It's bumpy"). If the meaning lives in the slang, rewrite the line.

ALLOWED FLAVOR (the whole list)
- receipts: only ever means a test run the map saw pass.
- no receipts yet.
- we ate: only on a landing where every step is checked and 0 tests are failing.
- not gonna lie: spelled out, turbulence only.
- on it, still at it, your move, hold up, hit (a button), tweak, take a look, cut (for removed), your idea, catch up, taking five.
- nope: only in "tests say nope".
Anything else needs a new entry in this list first.

BANNED
- Abbreviations: ngl, fr, tbh, idk, rn, imo, W/L, GOAT, POV.
- Slang that needs a dictionary: slay, no cap, bussin, rizz, periodt, sheesh, bestie, yeet, it's giving, delulu, mid, based, sus, aura, cooked, lowkey/highkey, main character, ate (outside "we ate"), understood the assignment, vibe check.
- Overclaims: nailed it, crushing it, perfect, flawless, easy, quick, almost done, nearly there, any ETA or percentage, "should work".
- Blame or sarcasm aimed at the person or the code ("you broke it", "lol", "oops" on a real failure).
- Fake urgency, baby talk, more than one "!" per state, ALL CAPS outside card tags.

EMOJI BUDGET
- Fun voice only, desktop only, at most one per line.
- Never in buttons, card tags, alt text, or Claude's own words.
- The whole set is three emoji: ✈️, ✅ and 🎟.
- ✅ is only for checks the map verified: status checked, and never on "you checked it".
- On the terminal surface, swap ✅ for ✓ and drop ✈️ and 🎟 (the glyph table already draws ✈).
- The text marks ✓ ✓✓ ✈ ⚑ ✻ ~ <> count as glyphs, not emoji, and are allowed in both voices.

HONESTY OUTRANKS FUN (v1's rules, kept)
- Celebrate only what the map verified. "receipts ✅", confetti, "we ate" and the celebrate pose all need either a step checked by a test run the map saw, or a landing where every non-skipped step is checked and the last run had 0 failing.
- Claude's own claims stay labelled as Claude's ("done (Claude's word)", "Claude says: …"), and the person's stay theirs ("you checked it"). A helper that finishes has "reported back", never "done ✓".
- Silence is never progress. "thinking" only shows after 5 s without a tool call (as in v1). The sky clock moves only when a step closes, says it isn't the real time, and rewinds with a reason when the route grows.
- Use counts, never percentages or arrival times. Failing tests are always named on the landed card and in the toast.

ONE WORD PER THING
- route.
- stop: replaces both "feature" and "waypoint" in everything the user sees. It lives in one constant, NOUN_STOP, so it can flip back to the preview's "waypoint" if the user prefers.
- step.
- the map.
- Claude (plain) / captain (fun, only in the captain chip).
- crew (fun) / helper (plain).
- Buttons: Take off now, Hold, Continue, Stop now.
- A hint that names a button quotes its exact label.

LENGTH LIMITS (58-column dock)
- Card tags: at most 16 chars, UPPERCASE.
- Chips: at most 24 chars, lowercase.
- Buttons: 1 to 4 words, at most 26 chars, sentence case.
- Hints and toasts: one sentence, at most 90 chars.
- Clock phrase: at most 22 chars.
- Pin labels: at most 8 chars.
- The band label truncates at the end.

SAME IN BOTH VOICES (not voiced)
- Claude's words: goal, titles, why, doing, question, choice, claim, helper descriptions, Bash descriptions.
- The details drawer: "working in:", "last command:", "last test run:".
- Numbers and units: 12s, 3 min, $0.42.
- Alt text, the chat spinner, the mobile summary, and config-menu labels.
- Everything submitted to Claude as the user: "Go: take off…" (the GO regex matches it), "Continue the route…", "Stop…", and the ask* prompts.
- Claude-only text: deny reasons, nudges, deliverEdits, promptNote, ExitPlanMode context, and "Only the main conversation updates the map."

PLACEHOLDERS
- {n}, {title}, {time} and the rest are filled at draw time.
- {s} is "s" unless the count is 1, and {is} is "is" or "are" by the same rule.
- No voiced string is ever stored in route state, because state outlives a voice switch. Fallback titles stay neutral ("Stop 2", "New step"), and "(Claude will plan this)" becomes a placeholder drawn at render time when why is empty and proposedBy is "you".

WIRING
- Put the deck in hooks/text.ts as DECK: Record<key, { fun; plain }>, read through say(key, voice, vars).
- Add a userConfig field "voice" (fun|plain, default fun) and mirror it into View, so "/flight voice plain" and the footer button switch it live.
- The existing userConfig key "fun" (full|calm) is about animation. Retitle it "Animations"; it is independent of voice.
- Tests: the flight tests assert v1 words. Run them with test(name, { options: { voice: 'plain' } }, …), since plain keeps ON THE GROUND, READY FOR TAKEOFF, NOW, LANDED, queued, "working in:" and "next:". Add one fun-voice test for IN THE AIR, receipts and TOUCHDOWN.

### deck

| key | fun | plain | where (v1) |
| --- | --- | --- | --- |
| `card.empty.tag` | ON THE GROUND | ON THE GROUND | pane.tsx tagRow (empty card): 'ON THE GROUND' |
| `card.empty.body` | No flight plan yet. Ask Claude for anything with a few steps and your route shows up here. | No flight plan yet. Ask Claude for something with more than one step, and the route appears here. | text.ts COPY.empty: 'No flight plan yet. Tell Claude what to build; when the work has more than one step, the route appears here.' |
| `card.ready.tag` | NOW BOARDING | READY FOR TAKEOFF | pane.tsx tagRow (ready card): 'READY FOR TAKEOFF' |
| `card.ready.summary` | {total} step{s}, {stops} stop{s} · {clock} | {total} step{s} in {stops} stop{s} · {clock} | pane.tsx ready card: '${c.total} steps under ${features.length} waypoints · ${clock}' |
| `card.ready.clock.countdown` | wheels up in {n}s | taking off in {n} s | pane.tsx ready card clock: 'taking off in ${view.countdown} s' |
| `card.ready.clock.held` | holding at the gate | on hold | pane.tsx ready card clock: 'held' |
| `card.ready.clock.waitGo` | waiting on your Take off | waiting for Take off | pane.tsx ready card clock: 'waiting for Take off' |
| `card.ready.clock.editing` | clock paused while you edit ({n}s left) | clock paused while you edit ({n} s left) | pane.tsx ready card clock: 'clock paused while you edit (${view.countdown} s)' |
| `card.ready.hint` | Click any step to tweak it before we leave the gate. | Click any step to change it before Claude starts. | text.ts COPY.readyHint: 'Click any step to change it before Claude starts.' |
| `card.ready.hintHeld` | Clock's stopped. Change whatever you like, then hit Take off now. | Clock paused. Change anything, then press Take off now. | text.ts COPY.holdHint: 'Clock paused. Change anything, then press Take off.' |
| `btn.takeoff` | Take off now | Take off now | pane.tsx ready card + drawBand Button: 'Take off now' |
| `btn.hold` | Hold up, let me look | Hold, let me look | pane.tsx ready card Button: 'Hold, let me look' |
| `card.ask.tag` | YOUR TURN | YOUR TURN | pane.tsx tagRow (ask card): 'YOUR TURN' |
| `card.ask.summary` | Claude needs you: {question} | Claude asks: {question} | pane.tsx ask card: 'Claude asks: ${question}' |
| `card.ask.fallback` | a question | a question | pane.tsx ask card fallback question: 'a question' |
| `card.ask.hint` | Answer in the chat. We'll circle till you do. | Answer in the chat; the plane circles until you do. | text.ts COPY.waitingQuestion: 'Answer in the chat; the plane circles until you do.' |
| `btn.showQuestion` | Take me there | Show me | pane.tsx ask card Button: 'Show me' |
| `card.turbulence.tag` | BUMPY AIR | TURBULENCE | pane.tsx tagRow (turbulence card): 'TURBULENCE' |
| `card.turbulence.summary` | Tests failed {n} times in a row on "{title}" | {n} test runs in a row failed on "{title}" | pane.tsx turbulence card: '${live.failedRuns} test runs in a row failed on "${title}"' |
| `card.turbulence.fallbackTitle` | this step | this step | pane.tsx turbulence card fallback: 'this step' |
| `card.turbulence.hint` | Not gonna lie, it's bumpy. Claude usually gets there, but you can step in. | Claude usually gets there, but you can nudge it. | text.ts COPY.turbulence: 'It usually gets there, but you can nudge it.' |
| `btn.nudge` | Try another way | Try another way | pane.tsx turbulence card Button: 'Try another way' |
| `btn.skipStuck` | Skip this step | Skip this step | pane.tsx turbulence card Button: 'Skip this step' |
| `card.holding.tag` | HOLDING PATTERN | HOLDING | pane.tsx tagRow (holding card): 'HOLDING' |
| `card.holding.at` | at "{title}" | at "{title}" | pane.tsx holding card: 'at "${planeStep.title}"' |
| `card.holding.toGo` | {n} step{s} to go | {n} step{s} to go | pane.tsx holding card: '${open.length} steps to go' |
| `card.holding.idle` | Your move: reply in the chat, or hit Continue. | Your turn: reply in the chat, or press Continue. | text.ts COPY.holdingIdle: 'your turn: reply in the chat, or press Continue' |
| `card.holding.blocked` | {n} step{s} stuck. {idle} | {n} step{s} blocked. {idle} | pane.tsx holding hint: '${n} step(s) is/are blocked; ${COPY.holdingIdle}.' |
| `card.holding.unclosed` | Claude stopped, but {n} step{s} still look open on the map. {idle} | Claude stopped with {n} step{s} not closed on the map. {idle} | pane.tsx holding hint: 'Claude stopped with ${n} step(s) not closed on the map; ${COPY.holdingIdle}.' |
| `btn.continue` | Continue | Continue | pane.tsx holding + paused cards Button: 'Continue' |
| `btn.askUpdate` | Ask Claude to catch the map up | Ask Claude to update the map | pane.tsx holding card Button: 'Ask Claude to update the map' |
| `btn.sendCount` | Send {n} change{s} now | Send {n} change{s} now | pane.tsx holding card Button: 'Send ${n} change(s) now' |
| `card.paused.tag` | TAKING FIVE | PAUSED | pane.tsx tagRow (paused card): 'PAUSED' |
| `card.paused.after` | after "{title}". Take your time. | after "{title}" | pane.tsx paused card: 'after "${planeStep.title}"' |
| `card.landed.tag` | TOUCHDOWN | LANDED | pane.tsx tagRow (landed card): 'LANDED' |
| `card.landed.headline.allChecked` | Touchdown, we ate. Every step is checked ✅ | Landed. Every step is checked. | NEW (v2) landed card first line; only when every non-skipped step is checked by a seen test and the last run had 0 failing |
| `card.landed.headline.untested` | Touchdown. {n} step{s} still need receipts. | Landed. {n} step{s} not tested yet. | NEW (v2) landed card first line when some steps are 'done' without a seen test |
| `card.landed.headline.failing` | Landed, but {n} test{s} failed on the last run. | Landed, but {n} test{s} failed on the last run. | NEW (v2) landed card first line when route.tests.failed > 0 (wins over the other two) |
| `card.landed.summary` | {total} steps · {files} file{s} · {tests} · {min} min | {total} steps · {files} file{s} · {tests} · {min} min | pane.tsx landed card: '${c.total} steps · ${files} files · ${tests} · ${minutes} min' |
| `card.landed.tests.none` | no tests seen | no tests seen | pane.tsx landed card tests: 'no tests seen' |
| `card.landed.tests.mixed` | {passed} passing, {failed} failing | {passed} passing, {failed} failing | pane.tsx landed card tests: '${passed} passing, ${failed} failing' |
| `card.landed.tests.pass` | {passed} tests passing ✅ | {passed} tests passing | pane.tsx landed card tests: '${passed} tests passing' |
| `card.landed.untested` | {n} done, no receipts yet | {n} done but not tested | pane.tsx landed card row: '${untested.length} done but not tested' |
| `btn.askCheck` | Ask Claude to test them | Ask Claude to check | pane.tsx landed card Button: 'Ask Claude to check' |
| `card.landed.flagged` | {n} call{s} Claude made for you | {n} choice{s} to review | pane.tsx landed card row: '${flagged.length} choice(s) to review' |
| `btn.review` | Take a look | Review | pane.tsx landed card Button: 'Review' |
| `card.landed.cost` | This flight's session cost so far: ${cost} | This flight's session cost so far: ${cost} | pane.tsx landed card: 'This flight's session cost so far: $${cost}' (money stays neutral) |
| `card.now.tag` | IN THE AIR | NOW | pane.tsx tagRow (now card): 'NOW' |
| `card.now.fallback` | getting set up | getting started | pane.tsx now card when no doing/step: 'getting started' |
| `card.now.activity` | ✻ {activity} · {ago} ago | {activity} · {ago} ago | pane.tsx now card activity line: '${activity} · ${ago} ago' (terminal-card status line, munderdiffl style) |
| `activity.thinking` | thinking it through | thinking | pane.tsx now card fallback + register.tsx turn.start activity: 'thinking' |
| `details.workingIn` | working in: {files} | working in: {files} | pane.tsx details: 'working in: ${files}' (fallback '—'); test asserts /working in: todo.js/ |
| `details.lastCommand.none` | last command: none yet | last command: none yet | pane.tsx details: 'last command: none yet' |
| `details.lastCommand` | last command: {cmd} → {gloss} | last command: {cmd} → {gloss} | pane.tsx details: 'last command: ${cmd} → ${gloss(cmd)}' (gloss now in -ing form) |
| `details.lastTest` | last test run: {passed} passed, {failed} failed | last test run: {passed} passed, {failed} failed | pane.tsx details: 'last test run: ${passed} passed, ${failed} failed' |
| `btn.pause` | Pause after this step | Pause after this step | pane.tsx now card Button: 'Pause after this step' |
| `btn.pausing` | Pausing after this one… | Pausing after this step | pane.tsx now card Button when paused: 'Pausing after this step' |
| `btn.addStop` | Add a stop | Add a stop | pane.tsx now card Button: 'Add a feature' |
| `btn.where` | Where are we? | Where are we? | pane.tsx now card Button: 'Where?' |
| `header.where.landed` | touchdown | landed | pane.tsx header right: 'landed' |
| `header.where.ready` | boarding | ready for takeoff | pane.tsx header right: 'ready for takeoff' |
| `header.where.step` | step {n} of {total} | step {n} of {total} | pane.tsx header right: 'step ${position} of ${total}' |
| `header.where.count` | {done} of {total} done | {done} of {total} done | pane.tsx header right: '${done} of ${total} done' |
| `header.bar` | {done} done · ~{left} to go | {done} done · ~{left} left | pane.tsx progress bar tail: '] ${done} done · ~${left} left' |
| `header.grew` |  +{n} new, route grew |  +{n} new | pane.tsx bar: ' +${addedCount} new' (shown 60 s) |
| `header.files` | {n} file{s} · {tests} | {n} file{s} · {tests} | pane.tsx bar right: '${files.length} files · ${tests}' |
| `header.tests.none` | no tests yet | no tests yet | pane.tsx bar tests: 'no tests yet' |
| `header.tests.failing` | {n} tests failing | {n} failing | pane.tsx bar tests: '${failed} failing' |
| `header.tests.pass` | {n} tests passing | {n} tests pass | pane.tsx bar tests: '${passed} tests pass' |
| `route.rule` | the route | route | pane.tsx rule label: 'route' |
| `stop.chip.proposed` | your idea | added by you | pane.tsx feature chip: 'proposed by you' |
| `stop.chip.removed` | cut by you | removed by you | pane.tsx feature chip: 'removed by you' |
| `stop.chip.checked` | all receipts ✅ | checked | pane.tsx feature chip (all checked): 'checked' |
| `stop.chip.untested` | done, no receipts yet | done, not tested | pane.tsx feature chip (all closed, not all checked): 'done, not tested' |
| `stop.chip.position` | step {pos} of {n} | step {pos} of {n} | pane.tsx feature chip: '${position} of ${live.length}' |
| `stop.chip.count` | {n} step{s} | {n} step{s} | pane.tsx feature chip: '${n} step(s)' |
| `stop.why.proposed` | (Claude still has to plan this) | (Claude will plan this) | model.ts userEdit add-feature why: '(Claude will plan this)'; draw it at render time, don't store it |
| `step.chip.now` | on it | now | pane.tsx CHIP.active (plane step): 'now' |
| `step.chip.started` | started | started | pane.tsx stepChip active, not plane: 'started' |
| `step.chip.done` | done, no receipts yet | done, not tested yet | pane.tsx CHIP.done / stepChip: 'done, not tested' |
| `step.chip.claudeSays` | done (Claude's word) | done, Claude says | pane.tsx stepChip: 'done, Claude says' |
| `step.chip.checked` | receipts ✅ | checked | pane.tsx CHIP.checked: 'checked' (only a seen test run) |
| `step.chip.youChecked` | you checked it ✓ | you checked it | pane.tsx stepChip: 'you checked it' (never ✅) |
| `step.chip.failed` | done? tests say nope | done? last test failed | pane.tsx CHIP.failed: 'done? last test failed' |
| `step.chip.skipped` | skipped | skipped | pane.tsx CHIP.skipped: 'skipped' |
| `step.chip.youSkipped` | skipped by you | skipped by you | pane.tsx stepChip: 'skipped by you' |
| `step.chip.blocked` | stuck | blocked | pane.tsx CHIP.blocked: 'blocked' |
| `step.chip.removed` | removed | removed | pane.tsx CHIP.removed: 'removed' |
| `step.chip.claudeDropped` | Claude dropped it | dropped by Claude | pane.tsx stepChip: 'dropped by Claude' |
| `step.chip.youRemoved` | cut by you | removed by you | pane.tsx stepChip: 'removed by you' |
| `step.retry` | try #{n}, hang tight | trying again ({n}) | pane.tsx under plane step: 'retry ${errorsInRow}' |
| `route.landing` | Touchdown: everything checked | Landing: everything checked | pane.tsx landing row: '⚑ Landing: everything checked' |
| `compact.next` | up next: {title} | next: {title} | pane.tsx compact inline card: 'next: ${title}' (test asserts /next: Tests cover/) |
| `crew.row` | crew · {chip} · {description} | helper · {chip} · {description} | pane.tsx helper row: '> helper: ${description} …' becomes the crew row |
| `add.label` | What else should we build? | Add a stop | pane.tsx add card Input label: 'New feature' |
| `add.placeholder` | e.g. Let people reset their password | e.g. Let people reset their password | pane.tsx add card placeholder: 'e.g. Let people reset their password' |
| `add.submit` | add | add | pane.tsx add card submitLabel: 'add' |
| `add.hint` | Shows up as "your idea" until Claude plans its steps. | It shows as "added by you" until Claude plans its steps. | pane.tsx add card: 'It appears as "proposed by you" until Claude plans its steps.' |
| `btn.close` | Close | Close | pane.tsx add/where/step/feature/decision editors Button: 'Close' |
| `where.title` | Where are we? | Where are we? | pane.tsx where card: 'Where are we?' |
| `where.asking` | Asking Claude… (costs about one message of your plan) | Asking Claude… (uses about one message of your plan) | register.tsx where(): 'Asking Claude… (uses about one message of your plan)' |
| `where.failed` | Claude couldn't answer right now ({reason}). | Claude could not answer just now ({reason}). | register.tsx where(): 'Claude could not answer just now (${reason}).' |
| `where.prompt` | In three short lines for someone who does not code: what is done, what you are doing now, and what is next. Friendly and a little playful; no jargon, no slang, no emoji. | In three short plain-English lines for someone who does not code: what is done, what you are doing now, and what is next. | register.tsx where() fork prompt (shapes the answer shown in the card): 'In three short plain-English lines for someone who does not code: what is done, what you are doing now, and what is next.' |
| `legend.checked` | v  receipts: a test the map saw pass | v  done and checked: a test the map saw pass | text.ts COPY.legend[0]: 'v  done and checked: a test the map saw pass' |
| `legend.untested` |    done, no receipts yet: finished, but no test proved it |    done, not tested yet: finished, but no test proved it | NEW (v2) legend line explaining the untested chip |
| `legend.now` | *  happening now; the plane's on it | *  in progress; the plane sits on the step | text.ts COPY.legend[1]: '*  in progress; the plane sits on the step' |
| `legend.pending` | o  not started yet | o  not started yet | text.ts COPY.legend[2]: 'o  not started yet' |
| `legend.failed` | !  done? the last test said nope | !  done? the last test failed | text.ts COPY.legend[3]: '!  done? the last test failed' |
| `legend.decision` | <> a call Claude made without asking you | <> a choice Claude made without asking you | text.ts COPY.legend[4]: '<> a choice Claude made without asking you' |
| `legend.edit` | ~  your edit, on its way to Claude | ~  your change, waiting for Claude | text.ts COPY.legend[5]: '~  your change, waiting for Claude' |
| `legend.landing` | ⚑  touchdown: everything checked | ⚑  landing: everything checked | text.ts COPY.legend[6]: '⚑  landing: everything checked' |
| `legend.clock` | ☀  sky clock: how far along we are, not the real time | ☀  the clock shows progress, not the real time | NEW (v2) legend line for the sky clock |
| `legend.crew` |    crew: helpers Claude sent off on side jobs |    helpers: side jobs Claude handed off | NEW (v2) legend line for crew sprites |
| `footer.elapsed` | {min} min | {min} min | pane.tsx footer: '${minutes} min' |
| `footer.stale` |  · last heard from Claude {ago} ago |  · Claude last checked in {ago} ago | pane.tsx footer: ' · Claude last checked in ${ago} ago' |
| `btn.details` | details | details | pane.tsx footer Button: 'details' |
| `btn.hideDetails` | hide details | hide details | pane.tsx footer Button: 'hide details' |
| `btn.legend` | what the marks mean | legend | pane.tsx footer Button: 'legend' |
| `btn.hideLegend` | hide the marks | hide legend | pane.tsx footer Button: 'hide legend' |
| `btn.voice` | plain words | fun words | NEW (v2) footer Button that switches voice (labels the voice you switch TO) |
| `badge.prefix` | your edit · | you changed this · | pane.tsx badgeRow: 'you changed this ·' |
| `badge.queued` | ~ queued: Claude sees it {when} | ~ queued: Claude sees it {when} | pane.tsx badgeText: '~ queued: Claude sees it ${when}' (test asserts /queued/) |
| `badge.when.gate` | at takeoff | when it takes off | pane.tsx badgeText when: 'when it takes off' |
| `badge.when.flying` | on its next move | on its next step | pane.tsx badgeText when: 'on its next step' |
| `badge.when.idle` | with your next message | with your next message | pane.tsx badgeText when: 'with your next message' |
| `badge.delivered` | ✓ sent to Claude | ✓ sent to Claude | pane.tsx badgeText: '✓ sent to Claude' |
| `badge.acked` | ✓✓ Claude's got it | ✓✓ Claude has it | pane.tsx badgeText: '✓✓ Claude has it' |
| `badge.unapplied` | Claude hasn't applied this yet | Claude has not applied this yet | pane.tsx badgeText: 'Claude has not applied this yet' |
| `btn.undoSmall` | undo | undo | pane.tsx badgeRow plain Button: 'undo' |
| `btn.sendNowSmall` | send now | send now | pane.tsx badgeRow plain Button: 'send now' |
| `editor.why` | why: {why} | why: {why} | pane.tsx step/feature editor: 'why: ${why}' / 'why: —' |
| `editor.detail` | files: {files} · check: {check} | files: {files} · check: {check} | pane.tsx step editor: 'files: ${files} · check: ${check}' |
| `editor.claim` | Claude says: {claim} | Claude says: {claim} | pane.tsx step editor: 'Claude says: ${claim}' (Claude's claim is never called a receipt) |
| `editor.rename.label` | Rename it | Change it to | pane.tsx step/feature editor Input label: 'Change it to' |
| `editor.rename.submit` | save | save | pane.tsx editor submitLabel: 'save' |
| `btn.undo` | Undo | Undo | pane.tsx step editor Button: 'Undo' |
| `btn.stopNow` | Stop now | Stop now | pane.tsx step editor Button: 'Stop now' |
| `btn.stopNow.armed` | Sure? Click to stop | Click again to stop | NEW (v2) Stop now label while view.armedStop is set (v1 relies on the toast alone) |
| `btn.skipAfter` | Skip it after this try | Skip it after this attempt | pane.tsx step editor Button: 'Skip it after this attempt' |
| `btn.redo` | Redo this | Redo this | pane.tsx step editor Button: 'Redo this' |
| `btn.iChecked` | I checked it | I checked it | pane.tsx step editor Button: 'I checked it' |
| `btn.skip` | Skip it | Skip it | pane.tsx step editor Button: 'Skip it' |
| `btn.remove` | Remove it | Remove it | pane.tsx step editor Button: 'Remove it' |
| `editor.hint.now` | Claude wraps up what it's doing, then changes course. | Claude finishes what it is doing, then changes course. | text.ts COPY.nowHint: 'Claude finishes what it is doing, then changes course.' |
| `editor.hint.done` | Claude circles back to redo this after the current step. | Claude redoes this after the current step. | text.ts COPY.doneHint: 'Claude redoes this after the current step.' |
| `editor.hint.gate` | Claude sees this at takeoff. | Claude sees this when it takes off. | pane.tsx stepEditor hint: 'Claude sees this when it takes off.' |
| `editor.hint.idle` | Claude sees this with your next message. | Claude sees this with your next message. | pane.tsx stepEditor hint: 'Claude sees this with your next message.' |
| `editor.hint.flying` | Claude picks this up once the current step wraps. | Claude sees this after the current step ends. | text.ts COPY.editHint: 'Claude sees this after the current step ends.' (step + feature editors) |
| `btn.removeStop` | Cut this stop | Remove this stop | pane.tsx featureEditor Button: 'Remove this feature' |
| `decision.claude` | Claude went with {choice} | Claude chose {choice} | pane.tsx decisionRows: 'Claude chose ${choice}' |
| `decision.you` | You picked {choice} | You chose {choice} | pane.tsx decisionRows: 'You chose ${userChoice}' |
| `decision.chip.flagged` | take a look | review | pane.tsx decision chip: 'review' |
| `decision.chip.kept` | kept | kept | pane.tsx decision chip: 'kept' |
| `decision.whyLine` | {question} · {why} | {question} · {why} | pane.tsx decision sub-line: '│  ${question} · ${why}' (Claude's words) |
| `decision.because` | Claude went with {choice} because {why} | Claude chose {choice} because {why} | pane.tsx decision editor: 'Claude chose ${choice} because ${why}' / 'Claude chose ${choice}' |
| `decision.impact.none` | Claude didn't list any steps that depend on it. | No steps are listed as depending on it. | model.ts impactText: 'no steps listed as depending on it' (pane copy; keep model's text for Claude's edit summary) |
| `decision.impact.lead` | If you switch: {parts} | If you switch it: {parts} | model.ts impactText: 'if switched: ${parts}' |
| `decision.impact.redo` | redo "{title}" (already done) | redo "{title}" (done) | model.ts impactText part: 'redo "${title}" (done)' |
| `decision.impact.change` | change "{title}" (happening now) | change "{title}" (in progress) | model.ts impactText part: 'change "${title}" (in progress)' |
| `decision.impact.plan` | re-plan "{title}" | plan "{title}" differently | model.ts impactText part: 'plan "${title}"' |
| `btn.keep` | Keep {choice} | Keep {choice} | pane.tsx decision editor Button: 'Keep ${choice}' |
| `btn.switch` | Switch to {alternative} | Switch to {alternative} | pane.tsx decision editor Button: 'Switch to ${alternative}' |
| `btn.askWhy` | Ask Claude why | Ask Claude why | pane.tsx decision editor Button: 'Ask Claude why' |
| `btn.askFirst` | Ask me first next time | Ask me first next time | pane.tsx decision editor Button: 'Ask me first next time' |
| `band.line` | Flight Plan  {label} | Flight Plan  {label} | pane.tsx drawBand: 'Flight Plan  ${label}' |
| `band.ready` | Now boarding: {n} step{s} · {clock} | Route ready: {n} step{s} · {clock} | pane.tsx drawBand: 'Route ready: ${total} steps · ${held\|taking off in n s\|waiting for Take off}' |
| `band.landed` | Touchdown: {done} of {total} done | Landed: {done} of {total} done | pane.tsx drawBand: 'Landed: ${done} of ${total} done' |
| `band.ask` | Your turn: Claude needs you | Your turn: Claude asked you something | pane.tsx drawBand: 'Your turn: Claude asked you something' |
| `band.flying` | {where} · {title} · {activity} | {where} · {title} · {activity} | pane.tsx drawBand: '${step n of total \| done of total done} · ${title} · ${activity}' |
| `btn.openMap` | Open the map | Open map | pane.tsx drawBand Button: 'Open map' |
| `btn.bandHold` | Hold up | Hold | pane.tsx drawBand Button: 'Hold' |
| `toast.checkedByYou` | Marked as checked by you ✓ | Marked as checked by you. | register.tsx editRoute toast: 'Marked as checked by you.' |
| `toast.changed.gate` | On the map. Claude sees it at takeoff. | Changed on the map. Claude reads it when it takes off. | register.tsx editRoute toast: 'Changed on the map. Claude reads it when it takes off.' |
| `toast.changed.flying` | On the map. Claude picks it up on its next move. | Changed on the map. Claude reads it on its next step. | register.tsx editRoute toast: 'Changed on the map. Claude reads it on its next step.' |
| `toast.changed.idle` | On the map. Claude sees it with your next message, or hit send now. | Changed on the map. Claude reads it with your next message, or press send now. | register.tsx editRoute toast: 'Changed on the map. Claude reads it with your next message, or press Send now.' |
| `toast.pause.set` | Got it. Claude pauses after this step. | Claude will pause after this step. | NEW (v2) toast after Pause (v1 shows the generic 'Changed on the map' toast) |
| `toast.pause.cancelled` | Pause cancelled. Carry on. | Pause cancelled. | register.tsx actions.pause toast: 'Pause cancelled.' |
| `toast.nothingToSend` | Nothing in the queue to send. | Nothing waiting to send. | register.tsx sendNow toast: 'Nothing waiting to send.' |
| `toast.stopArm` | Click Stop now again to cut in. A file might be half-edited; Claude's told to check. | Press Stop now again to interrupt Claude. A file may be left half-edited; Claude is told to check. | register.tsx stopNow toast: 'Press Stop now again to interrupt Claude. A file may be left half-edited; Claude is told to check.' |
| `toast.undo.ok` | Undone. Claude never saw it. | Undone before Claude saw it. | register.tsx undo toast: 'Undone before Claude saw it.' |
| `toast.undo.late` | Too late, Claude already saw that one. | Claude has already seen that change. | register.tsx undo toast: 'Claude has already seen that change.' |
| `toast.landed.allChecked` | Touchdown, we ate ✈️ Every step is done and checked. | Landed: every step is done and checked. | register.tsx turn.complete toast: 'Landed: every step on the route is done.' (now only when all checked) |
| `toast.landed.untested` | Touchdown. Every step's done; {n} still need receipts. | Landed: every step is done; {n} not tested yet. | NEW (v2) landing toast when some steps are done without a seen test |
| `toast.landed.failing` | Landed, but the last test run had {n} failing. | Landed, but the last test run had {n} failing. | register.tsx turn.complete toast: 'Landed, but the last test run had ${failed} failing.' |
| `toast.blockedLeft` | Everything's done except {n} stuck. Check the map. | Every step is done except {n} blocked. See the map. | register.tsx turn.complete toast: 'Every step is done except ${blocked} blocked. See the map.' |
| `cmd.description` | Open the Flight Plan map (also: go, hold, pause, show, details, voice fun\|plain, sound on\|off) | Open the Flight Plan map (also: go, hold, pause, show, details, voice fun\|plain, sound on\|off) | register.tsx command.register description: 'Open the Flight Plan map (also: go, hold, pause, show, details, sound on\|off)' |
| `cmd.argumentHint` | [go\|hold\|pause\|show\|details\|voice fun\|plain\|sound on\|off] | [go\|hold\|pause\|show\|details\|voice fun\|plain\|sound on\|off] | register.tsx argumentHint: '[go\|hold\|pause\|show\|details\|sound on\|off]' |
| `cmd.go.ok` | Wheels up ✈️ | Taking off. | register.tsx /flight go: 'Taking off.' |
| `cmd.gate.none` | Nothing's waiting at the gate. | No route is waiting at the gate. | register.tsx /flight go + hold: 'No route is waiting at the gate.' |
| `cmd.hold.ok` | Holding at the gate. Change anything, then hit Take off now. | Holding: change anything on the map, then press Take off now. | register.tsx /flight hold: 'Holding: change anything on the map, then press Take off.' |
| `cmd.pause.none` | Nothing's flying right now. | No flight in progress. | register.tsx /flight pause: 'No flight in progress.' |
| `cmd.pause.ok` | Got it. Claude finishes this step, updates the map, then stops. | Claude will finish the step it is on, update the map, and stop. | register.tsx /flight pause: 'Claude will finish the step it is on, update the map, and stop.' |
| `cmd.details.on` | Details on. | Showing details on the map. | register.tsx /flight details: 'Toggled details on the map.' (split by new state) |
| `cmd.details.off` | Details off. | Hiding details on the map. | register.tsx /flight details: 'Toggled details on the map.' (split by new state) |
| `cmd.sound.off` | Sounds off. Quiet cabin. | Flight Plan sounds off. | register.tsx /flight sound off: 'Flight Plan sounds off.' |
| `cmd.sound.on` | Sounds back on. | Flight Plan sounds on. | register.tsx /flight sound on: 'Flight Plan sounds on.' |
| `cmd.voice` | Fun words are on. Let's fly ✈️ | Plain words are on. | NEW (v2) /flight voice fun\|plain reply, written in the voice just chosen |
| `cmd.show.none` | No flight plan yet. | No flight plan yet. | register.tsx /flight show: 'No flight plan yet.' |
| `cmd.show.header` | {goal}: {done} of {total} done | {goal}: {done} of {total} done | register.tsx /flight show: '${goal}: ${done} of ${total} done' |
| `cmd.show.line` | {mark} {title} ({chip}) | {mark} {title} ({chip}) | register.tsx /flight show line: '${mark} ${title} (${step.status})' (raw enum like 'pending'; use the step chip instead) |
| `cmd.open.ok` | Map's open. | Flight Plan map opened. | register.tsx /flight: 'Flight Plan map opened.' |
| `cmd.open.offscreen` | The map's open but not on screen yet: {reason} | The map is open but not on screen yet: {reason} | register.tsx /flight: 'The map is open but not on screen yet: ${reason}' |
| `spinner.step` | ✈ Step {n} of {total} · {title} | ✈ Step {n} of {total} · {title} | register.tsx Spinner message: '✈ Step ${position} of ${total} · ${title}' (shared chat chrome; neutral) |
| `mobile.title` | Flight Plan | Flight Plan | register.tsx mobile Pane fallback title: 'Flight Plan' |
| `mobile.none` | No flight plan yet. | No flight plan yet. | register.tsx mobile Pane: 'No flight plan yet.' |
| `mobile.count` | {done} of {total} steps done | {done} of {total} steps done | register.tsx mobile Pane: '${done} of ${total} steps done' |
| `pane.title` | Flight Plan | Flight Plan | register.tsx TITLE: 'Flight Plan' |
| `alt.plane.here` | The plane: Claude is here | The plane: Claude is here | pane.tsx Svg alt: 'The plane: Claude is here' (alt text stays plain) |
| `alt.plane.waiting` | The plane: waiting for you | The plane: waiting for you | pane.tsx Svg alt: 'The plane: waiting for you' |
| `alt.confetti` | Confetti: landed with every step checked | Confetti: landed with every step checked | pane.tsx landing Svg alt: 'confetti' |
| `alt.sky` | Sky at {time}: {phrase} | Sky at {time}: {phrase} | NEW (v2) scene Svg alt |
| `alt.captain` | Claude, the captain: {chip} | Claude, the captain: {chip} | NEW (v2) captain sprite alt |
| `alt.crew` | A helper: {chip} | A helper: {chip} | NEW (v2) crew sprite alt (no names) |
| `alt.pin` | Stop {i} of {n}: {title} | Stop {i} of {n}: {title} | NEW (v2) airport pin alt / <title> tooltip |
| `prompt.go` | Go: take off and start the route with "{first}". | Go: take off and start the route with "{first}". | register.tsx takeOff submit asUser: 'Go: take off and start the route with "${first}".' (GO regex depends on the prefix; never voice it) |
| `prompt.sendNow` | {edits}<br>Apply these now and update the map. | {edits}<br>Apply these now and update the map. | register.tsx sendNow submit asUser: '${edits}\nApply these now and update the map.' |
| `prompt.continue` | Continue the route from where you stopped. | Continue the route from where you stopped. | register.tsx resume submit asUser: 'Continue the route from where you stopped.' |
| `prompt.stop` | Stop. The user interrupted the step you were on. Check for half-finished edits first, then re-plan with the Flight Plan map. | Stop. The user interrupted the step you were on. Check for half-finished edits first, then re-plan with the Flight Plan map. | register.tsx stopNow submit asUser: 'Stop. The user interrupted the step you were on. Check for half-finished edits first, then re-plan with the Flight Plan map.' |
| `prompt.askCheck` | Run the checks for the steps the map shows as "done, not tested yet", then close them on the map with what you found. | Run the checks for the steps the map shows as "done, not tested yet", then close them on the map with what you found. | register.tsx askToCheck submit asUser: 'Run the checks for the steps the map shows as "done, not tested", then close them on the map with what you found.' (update the quoted chip to the plain-voice chip) |
| `prompt.askUpdate` | Update the Flight Plan map: close the steps you finished with route step (finish takes several ids, with evidence), then say in one line what is left. | Update the Flight Plan map: close the steps you finished with route step (finish takes several ids, with evidence), then say in one line what is left. | register.tsx askToUpdate submit asUser: 'Update the Flight Plan map: close the steps you finished with route step (finish takes several ids, with evidence), then say in one line what is left.' |
| `prompt.askWhy` | Why did you choose {choice} for "{question}"? One short paragraph for someone who does not code. | Why did you choose {choice} for "{question}"? One short paragraph for someone who does not code. | register.tsx askWhy submit asUser: 'Why did you choose ${choice} for "${question}"? One short paragraph for someone who does not code.' |
| `config.departure` | Departure: Before Claude starts a new route: a countdown you can hold, wait for Take off, or go at once | Departure: Before Claude starts a new route: a countdown you can hold, wait for Take off, or go at once | plugin.json userConfig.departure title 'Departure', description 'Before Claude starts a new route: a countdown you can hold, wait for Take off, or go at once' (config menu: one text) |
| `config.countdown` | Countdown seconds: How long the departure countdown waits | Countdown seconds: How long the departure countdown waits | plugin.json userConfig.countdownSeconds title 'Countdown seconds', description 'How long the departure countdown waits' |
| `config.sounds` | Sounds: Ticks, chimes, the knock and the landing fanfare | Sounds: Ticks, chimes, the knock and the landing fanfare | plugin.json userConfig.sounds title 'Sounds', description 'Ticks, chimes, the knock and the landing fanfare' |
| `config.animations` | Animations: The pixel sky, plane and crew, or calm text marks | Animations: The pixel sky, plane and crew, or calm text marks | plugin.json userConfig.fun title 'Plane', description 'The animated plane, or calm text marks' (key stays 'fun' for compatibility; retitle) |
| `config.voice` | Words: Fun (light, a little gen-z) or plain, friendly words on the map | Words: Fun (light, a little gen-z) or plain, friendly words on the map | NEW (v2) plugin.json userConfig.voice, options ['fun','plain'], default 'fun' |
| `model.fallback.stop` | Stop {n} | Stop {n} | model.ts applySet feature title fallback: 'Waypoint ${n}' (stored in state: neutral) |
| `model.fallback.step` | Step {n} | Step {n} | model.ts applySet step title fallback: 'Step ${n}' |
| `model.fallback.newStop` | New stop | New stop | model.ts applyPatch feature fallback: 'New waypoint' |
| `model.fallback.newStep` | New step | New step | model.ts applyPatch step fallback: 'New step' |
| `model.fallback.goal` | This task | This task | model.ts applySet goal fallback: 'This task' |
| `activity.edit` | editing {file} | editing {file} | text.ts activityFor: 'editing ${basename(file)}' |
| `activity.read` | reading {file} | reading {file} | text.ts activityFor: 'reading ${basename(file)}' |
| `activity.look` | poking around the code | looking around the code | text.ts activityFor: 'looking around the code' |
| `activity.web` | looking something up | looking something up | text.ts activityFor: 'looking something up' |
| `activity.helper` | calling in crew | sending a helper | text.ts activityFor: 'sending a helper' |
| `activity.ask` | asking you something | asking you something | text.ts activityFor: 'asking you something' |
| `activity.map` | updating the map | updating the map | text.ts activityFor: 'updating the map' |
| `activity.tool` | using {tool} | using {tool} | text.ts activityFor: 'using ${tool}' |
| `gloss.tests` | running the tests | running the automatic checks | text.ts GLOSSES rows 1-2 (npm test, jest, pytest, go test…): 'runs the automatic checks'; -ing form so it reads as an activity too |
| `gloss.typecheck` | checking the code for mistakes | checking the code for mistakes | text.ts GLOSSES tsc: 'checks the code compiles' |
| `gloss.lint` | checking the code looks tidy | checking the code style | text.ts GLOSSES eslint: 'checks code style' |
| `gloss.build` | building the app | building the app | text.ts GLOSSES build: 'builds the app' |
| `gloss.install` | adding a ready-made add-on | adding a ready-made code library | text.ts GLOSSES install: 'adds a library' |
| `gloss.commit` | saving a checkpoint | saving a checkpoint | text.ts GLOSSES git commit: 'saves a checkpoint' |
| `gloss.gitLook` | looking at what changed | looking at what changed | text.ts GLOSSES git status/diff/log: 'looks at what changed' |
| `gloss.files` | looking around the files | looking around the files | text.ts GLOSSES ls/find/cat/grep: 'looks around the files' |
| `gloss.run` | running the program | running the program | text.ts GLOSSES node/python script: 'runs the program' |
| `gloss.fallback` | running a command | running a command | text.ts gloss fallback: 'runs a command' |
| `scene.clock` | {time} · {phrase} | {time} · {phrase} | NEW (v2) sky clock label template |
| `scene.phrase.empty` | quiet airport | nothing planned yet | NEW (v2) clock phrase: no route (5:30 AM) |
| `scene.phrase.boarding` | now boarding | boarding | NEW (v2) clock phrase: gate, countdown running (5:45 AM) |
| `scene.phrase.gateHold` | holding at the gate | on hold | NEW (v2) clock phrase: gate held (5:45 AM) |
| `scene.phrase.waitGo` | waiting on you | waiting for Take off | NEW (v2) clock phrase: gate, departure 'go' (5:45 AM) |
| `scene.phrase.wheelsUp` | wheels up | just started | NEW (v2) clock phrase: flying, 0 steps closed (6:00 AM) |
| `scene.phrase.climbing` | climbing | under way | NEW (v2) clock phrase: done/total < 1/3 |
| `scene.phrase.cruising` | cruising | cruising | NEW (v2) clock phrase: default mid-flight |
| `scene.phrase.approach` | on approach | last steps | NEW (v2) clock phrase: 2 or fewer steps left, at least 1 closed |
| `scene.phrase.thinking` | thinking it over | thinking | NEW (v2) clock phrase: pose thinking (no tool call 5 s) |
| `scene.phrase.nextStep` | onto the next one | next step | NEW (v2) clock phrase: pose flying (plane just moved, 1.5 s) |
| `scene.phrase.receipts` | receipts ✅ | step checked | NEW (v2) clock phrase: pose celebrate (checked count rose, 2.5 s) |
| `scene.phrase.yourTurn` | your turn | waiting for your answer | NEW (v2) clock phrase: Claude asked a question |
| `scene.phrase.bumpy` | bumpy air | having trouble | NEW (v2) clock phrase: turbulence |
| `scene.phrase.holding` | holding pattern | waiting for you | NEW (v2) clock phrase: Claude idle with steps open |
| `scene.phrase.paused` | taking five | paused | NEW (v2) clock phrase: paused by you |
| `scene.phrase.grew` | route grew | new steps added | NEW (v2) clock phrase: 60 s after the route grew (clock moved back) |
| `scene.phrase.landedAll` | touchdown, we ate | landed, all checked | NEW (v2) clock phrase: landed, all checked, 0 failing (7:00 PM) |
| `scene.phrase.landedUntested` | landed, needs receipts | landed, not all tested | NEW (v2) clock phrase: landed, some steps not tested (7:00 PM) |
| `scene.phrase.landedFailing` | landed, tests failing | landed, tests failing | NEW (v2) clock phrase: landed with failing tests (7:00 PM) |
| `scene.phrase.night` | parked for the night | all done | NEW (v2, optional) clock phrase: landed 10+ min ago (9:00 PM, mood only) |
| `scene.tooltip` | Sky time shows how far along the trip is, not the real time. It only moves when a step gets done. | This clock shows progress, not the real time. It moves only when a step is done. | NEW (v2) <title> tooltip on the sky Svg (isInteractive) |
| `pin.start` | gate | start | NEW (v2) scene strip label under the departure airport (≤ 8 chars) |
| `pin.end` | landing | finish | NEW (v2) scene strip label under the arrival airport |
| `pin.fallback` | stop {i} | stop {i} | NEW (v2) pin label when Claude gave no short pin word (optional schema field 'pin') |
| `pass.header` | 🎟 BOARDING PASS · stop {i} of {n} | BOARDING PASS · stop {i} of {n} | NEW (v2) boarding-pass card header per expanded stop (mono small caps) |
| `pass.route` | FROM {from} → TO {to} · {steps} step{s} · {checked} with receipts | FROM {from} → TO {to} · {steps} step{s} · {checked} checked | NEW (v2) boarding-pass second line |
| `captain.label` | captain | Claude | NEW (v2) captain chip row label |
| `captain.chip.cruise` | on it | working | NEW (v2) captain chip, pose cruise |
| `captain.chip.thinking` | thinking… | thinking | NEW (v2) captain chip, pose thinking |
| `captain.chip.flying` | next step | starting the next step | NEW (v2) captain chip, pose flying |
| `captain.chip.waiting` | needs you | waiting for you | NEW (v2) captain chip, your turn / holding pose |
| `captain.chip.bumpy` | bumpy air | having trouble | NEW (v2) captain chip, pose turbulence |
| `captain.chip.receipts` | receipts ✅ | step checked | NEW (v2) captain chip, pose celebrate (verified only) |
| `captain.chip.ready` | ready at the gate | ready | NEW (v2) captain chip at the gate |
| `captain.chip.paused` | on a break | paused | NEW (v2) captain chip, paused card |
| `captain.chip.standby` | on standby | idle | NEW (v2) captain chip, idle mid-route (parked pose) |
| `captain.chip.landed` | touched down | landed | NEW (v2) captain chip, landed |
| `crew.label` | crew | helper | NEW (v2) crew row label (no names) |
| `crew.chip.onIt` | on it | working | NEW (v2) crew chip: running under 60 s |
| `crew.chip.stillAt` | still at it | still working | NEW (v2) crew chip: running 60 s or more |
| `crew.chip.back` | reported back | finished | NEW (v2) crew chip: finished (row stays 30 s); never claims success |
| `crew.chip.snag` | hit a snag | ran into a problem | NEW (v2) crew chip: finished with an error |
| `crew.chip.denied` | didn't board | didn't start | NEW (v2) crew chip: refused before it ran |
| `crew.header` | crew on board: {n} | {n} helpers working | NEW (v2) crew group header when 2+ helpers |
| `crew.more` | +{n} more crew | +{n} more helper{s} | NEW (v2) crew overflow row past 4 |

### clockLabels

THE SKY CLOCK SHOWS PROGRESS, NOT THE REAL TIME
Format: "{time} · {phrase}". Both voices show the same time; only the phrase changes.

How the time is worked out
- time = 6:00 AM + 780 min × done/total, rounded down to the minute and shown as "h:mm AM/PM" with no leading zero ("10:20 AM").
- done and total come from counts() (closed steps / live steps), the same numbers as the bar.
- So the clock moves only when a step closes. It freezes during your turn, holding and paused. It moves back when the route grows, and then shows the "route grew" phrase for 60 s.
- Fixed times: empty 5:30 AM, at the gate 5:45 AM, takeoff 6:00 AM, landed always 7:00 PM. Optional: 9:00 PM once the flight has been landed for 10 min or more (mood only, claims no progress).
- Sky stages for the pixel art: pre-dawn 5:30, sunrise 5:45–7, morning 7–11, midday 11–2, afternoon 2–5, golden hour 5–7, sunset 7 PM, night 9 PM.

Phrase table (first match wins) — fun / plain — example
1. No route: "quiet airport" / "nothing planned yet" — 5:30 AM · quiet airport
2. Gate, countdown running: "now boarding" / "boarding" — 5:45 AM · now boarding
3. Gate, held: "holding at the gate" / "on hold"
4. Gate, waiting for Take off: "waiting on you" / "waiting for Take off"
5. Landed, all checked, 0 failing: "touchdown, we ate" / "landed, all checked" — 7:00 PM · touchdown, we ate
6. Landed with failing tests: "landed, tests failing" / "landed, tests failing"
7. Landed, some steps not tested: "landed, needs receipts" / "landed, not all tested"
8. Landed 10+ min ago (optional): "parked for the night" / "all done" — 9:00 PM · parked for the night
9. Claude asked you something: "your turn" / "waiting for your answer" — 11:05 AM · your turn
10. Turbulence: "bumpy air" / "having trouble" — 11:05 AM · bumpy air
11. Paused: "taking five" / "paused"
12. Holding (Claude idle, steps still open): "holding pattern" / "waiting for you"
13. Celebrate (checked count just went up, 2.5 s): "receipts ✅" / "step checked"
14. Route grew (60 s after "+N new"): "route grew" / "new steps added"
15. Plane just moved (1.5 s): "onto the next one" / "next step"
16. Thinking (no tool call for 5 s): "thinking it over" / "thinking"
17. Flying with 0 steps closed: "wheels up" / "just started" — 6:00 AM · wheels up
18. 2 or fewer steps left, at least 1 closed: "on approach" / "last steps" — 4:40 PM · on approach
19. done/total under 1/3: "climbing" / "under way" — 8:10 AM · climbing
20. Anything else: "cruising" / "cruising" — 10:20 AM · cruising

Every phrase is 22 chars or fewer. Phrases 5–8 rank above "your turn" because a landed card wins in cardOf.

Honesty notes
- "receipts ✅" and "touchdown, we ate" use the same verified-only rules as the chips.
- "on approach" and "last steps" are counts of steps, not ETAs.
- The time never moves just because time passed, except the optional landed night.

Hover tooltip (<title> in the sky Svg)
- fun: "Sky time shows how far along the trip is, not the real time. It only moves when a step gets done."
- plain: "This clock shows progress, not the real time. It moves only when a step is done."

Alt text: "Sky at {time}: {phrase}".

Calm mode (Animations: calm) keeps the label as a plain Text line with no Svg. The legend explains it with "☀  sky clock: how far along we are, not the real time" (fun) or "☀  the clock shows progress, not the real time" (plain).

### crewChips

CAPTAIN (Claude)
One chip beside the pixel captain on the in-flight card and in the scene.
- Label: "captain" (fun) / "Claude" (plain). Row: "{label} · {chip}". Alt: "Claude, the captain: {chip}".
- Driven by v1's poseOf() and cardOf(), in this order — fun / plain:
  - landed: "touched down" / "landed"
  - your turn, or the holding pose: "needs you" / "waiting for you"
  - turbulence: "bumpy air" / "having trouble"
  - celebrate (only when a seen test just checked a step): "receipts ✅" / "step checked"
  - flying (the plane just moved): "next step" / "starting the next step"
  - at the gate: "ready at the gate" / "ready"
  - paused: "on a break" / "paused"
  - idle mid-route (parked pose): "on standby" / "idle"
  - thinking (no tool call for 5 s): "thinking…" / "thinking"
  - cruise: "on it" / "working"

CREW (helpers, i.e. Agent/Task subagents)
Pixel crew members.
- No names, no numbers used as names, and no faces that imply a person. A crew member is identified only by its chip and Claude's own description of the job.
- Row under the plane's step (v1's helper position): "crew · {chip} · {description}" (fun) / "helper · {chip} · {description}" (plain). The description is shown word for word and cut off at the end if it's too long.
- Chips, 14 chars or fewer — fun / plain:
  - running, under 60 s: "on it" / "working"
  - running, 60 s or more: "still at it" / "still working"
  - finished (row stays 30 s, then leaves): "reported back" / "finished"
  - finished with an error: "hit a snag" / "ran into a problem"
  - refused before it ran: "didn't board" / "didn't start"
- With 2 or more: header "crew on board: {n}" / "{n} helpers working".
- Past 4 rows: "+{n} more crew" / "+{n} more helpers".
- When Claude sends one, the activity line reads "calling in crew" / "sending a helper". Alt: "A helper: {chip}".

Honesty
- "reported back" never means success. The map can't judge a helper's answer, so crew never get ✅, confetti or "receipts".
- Subagent route calls are already refused ("Only the main conversation updates the map."), so crew never move the plane.

Data the chips need
Live.helpers has to carry isError, isDenied, startedAt and doneAt; v1 only has isDone and clears the list at turn end. Keep finished rows for 30 s so "reported back" is actually seen.

### claudeGuidance

Replace the second paragraph of ROUTE_DESCRIPTION in hooks/contract.ts (v1: "Wording first: write for someone who does not code. A title is the outcome in the user's words ("Let users log in with Google"), never a file, function or library name; why is one plain line. Paths go in files, commands in check.", 229 chars) with exactly:

Wording first: write for anyone who does not code, 16 or 60. A title is the outcome in everyday words, as a friend would say it ("Let people log in with Google"), never a file, function or library name; why is one plain line; doing is short, present tense ("hooking up the login button"). Warm, not slangy, no emoji: the map adds the fun.  Paths go in files, commands in check.

Character count (measured): the new paragraph is 376 chars, which adds 147 chars. The total description goes from 1,864 to 2,011 chars, 37 under the 2,048 limit. Measure again after pasting, because one extra space slipped in after "the fun." above; remove it so there is a single space and the count is exactly 376.

Why it's worded this way
- The description stays byte-stable and the same in both voices, so the prompt cache holds and one contract serves both settings.
- Claude writes warm, everyday titles. The mod adds the gen-z layer (tags, chips, clock, toasts). This keeps Claude's words readable in plain mode and stops cringe from leaking into titles.

Optional, outside the 2,048 budget (schema descriptions)
- doing: "step: what you are doing now, present tense, everyday words (hooking up the login button)."
- A new feature field: pin: { type: 'string', maxLength: 10, description: 'One everyday word for the map pin (login).' }. It feeds the airport labels; without it the label falls back to "stop {i}".

### examples

MID-FLIGHT, FUN VOICE (desktop dock, 58 columns, step 4 of 9; [..] are buttons, (sprite) is pixel Svg)

Add Google sign-in                                  step 4 of 9
[###......] 3 done · ~6 to go        7 files · 11 tests passing

 10:20 AM · cruising                 (morning sky, clouds drifting)
 (gate)··✓······✈·······○·······○··(landing)
  gate  setup   login   memory  tests  landing

╭──────────────────────────────────────────────────────╮
│ (captain) IN THE AIR  hooking up the login button    │
│ ✻ editing auth-callback.ts · 12s ago                 │
│ captain · on it                                      │
│ [Pause after this step] [Add a stop] [Where are we?] │
╰──────────────────────────────────────────────────────╯
──────────────────────── the route ───────────────────────
v Get the app ready for logins               all receipts ✅
│
╭──────────────────────────────────────────────────────╮
│ 🎟 BOARDING PASS · stop 2 of 4                       │
│ FROM setup → TO login · 3 steps · 1 with receipts    │
│ Let people log in with Google                        │
│ ├─ v  Add the "Continue with Google" button  receipts ✅
│ ├─ ✈  Handle Google's reply                     on it │
│ │     so the app knows who just signed in            │
│ │     crew · on it · Find how other pages do logins  │
│ └─ o  Show their name and photo                      │
│      your edit · ~ queued: Claude sees it on its next move  undo
╰──────────────────────────────────────────────────────╯
<> Claude went with a sign-in helper (NextAuth)   take a look
│  How should the app talk to Google? · less code to look after
│
o Remember people between visits                    2 steps
│  so nobody has to log in every single time
│
o Make sure it all works                            2 steps
│  so you know it's solid before you ship
│
⚑ Touchdown: everything checked
──────────────────────────────────────────────────────────
14 min                 details · what the marks mean · plain words

MID-FLIGHT, PLAIN VOICE (same moment)

Add Google sign-in                                  step 4 of 9
[###......] 3 done · ~6 left           7 files · 11 tests pass

 10:20 AM · cruising
 (start)··✓······✈·······○·······○··(finish)
  start  setup   login   memory  tests  finish

╭──────────────────────────────────────────────────────╮
│ (captain) NOW  hooking up the login button           │
│ editing auth-callback.ts · 12s ago                   │
│ Claude · working                                     │
│ [Pause after this step] [Add a stop] [Where are we?] │
╰──────────────────────────────────────────────────────╯
────────────────────────── route ─────────────────────────
v Get the app ready for logins                     checked
│
╭──────────────────────────────────────────────────────╮
│ BOARDING PASS · stop 2 of 4                          │
│ FROM setup → TO login · 3 steps · 1 checked          │
│ Let people log in with Google                        │
│ ├─ v  Add the "Continue with Google" button   checked │
│ ├─ ✈  Handle Google's reply                       now │
│ │     so the app knows who just signed in            │
│ │     helper · working · Find how other pages do logins
│ └─ o  Show their name and photo                      │
│      you changed this · ~ queued: Claude sees it on its next step  undo
╰──────────────────────────────────────────────────────╯
<> Claude chose a sign-in helper (NextAuth)            review
│  How should the app talk to Google? · less code to look after
│
o Remember people between visits                    2 steps
o Make sure it all works                            2 steps
⚑ Landing: everything checked
──────────────────────────────────────────────────────────
14 min                         details · legend · fun words

OTHER MOMENTS (fun | plain)

At the gate
  NOW BOARDING  9 steps, 4 stops · wheels up in 24s
  Click any step to tweak it before we leave the gate.
  [Take off now] [Hold up, let me look]          5:45 AM · now boarding
  | READY FOR TAKEOFF  9 steps in 4 stops · taking off in 24 s
  | Click any step to change it before Claude starts.
  | [Take off now] [Hold, let me look]           5:45 AM · boarding

Turbulence
  BUMPY AIR  Tests failed 3 times in a row on "Handle Google's reply"
  Not gonna lie, it's bumpy. Claude usually gets there, but you can step in.
  [Try another way] [Skip this step]             11:05 AM · bumpy air
  | TURBULENCE  3 test runs in a row failed on "Handle Google's reply"
  | Claude usually gets there, but you can nudge it.
  | [Try another way] [Skip this step]           11:05 AM · having trouble

Your turn
  YOUR TURN  Claude needs you: Should people stay logged in for 30 days?
  Answer in the chat. We'll circle till you do.  [Take me there]
  | YOUR TURN  Claude asks: Should people stay logged in for 30 days?
  | Answer in the chat; the plane circles until you do.  [Show me]

Landed, everything verified
  TOUCHDOWN  Touchdown, we ate. Every step is checked ✅
  9 steps · 7 files · 11 tests passing ✅ · 38 min      7:00 PM · touchdown, we ate
  toast: Touchdown, we ate ✈️ Every step is done and checked.
  | LANDED  Landed. Every step is checked.
  | 9 steps · 7 files · 11 tests passing · 38 min       7:00 PM · landed, all checked

Landed, not all verified (no celebration)
  TOUCHDOWN  Touchdown. 2 steps still need receipts.
  2 done, no receipts yet [Ask Claude to test them]   7:00 PM · landed, needs receipts
  | LANDED  Landed. 2 steps not tested yet.
  | 2 done but not tested [Ask Claude to check]       7:00 PM · landed, not all tested

Band above the prompt (map hidden)
  ✈ Flight Plan  step 4 of 9 · Handle Google's reply · editing auth-callback.ts  [Open the map]
  | ✈ Flight Plan  step 4 of 9 · Handle Google's reply · editing auth-callback.ts  [Open map]

## 3. Engine

### svgSizing

Plain version: make the sky picture stretch to fill the panel by itself, without guessing pixel sizes.

ENGINE FACTS (the engine's claude-code.d.ts)
- SvgProps, L12272-12299:
  - source: at most 131072 characters (L12273-12276).
  - alt: required (L12277-12281).
  - width: "CSS pixels; absent, the box takes the markup's own width up to the slot" (L12282-12285).
  - height: "CSS pixels; absent, the markup's own height at the drawn width" (L12286-12289).
  - isInteractive: sandboxed frame where SMIL, :hover and <title> work (L12290-12298).
  - SvgProps has no key.
- RenderViewport doc, L10382-10389: on a remote surface, cells are the pane width divided by the code font's advance. So a px-per-cell value exists but is never exposed.
- Pane bodyColumns is in cells (L10327).
- Box width takes number | string (L966), so "100%" and "25%" are legal. Box backgroundColor is at L987, hover backgroundColor at L878.
- reference.md L115: a change of width re-runs every hooked site.

PRIMARY RECIPE
1. Never pass width or height to the banner Svg. Put an intrinsic size in the markup. It acts as both the maximum width and the aspect ratio:
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 48" width="960" height="240" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
   - Drawn width = min(960px, slot). Height = width/4.
   - Example: a ~58-column dock is about 440px wide, so the banner is about 110px tall.
   - 1 viewBox unit = 1 art pixel.
2. JSX:
   <Box key="sky" flexDirection="column" width="100%" flexShrink={0}><Svg source={scene.svg} alt={scene.alt} isInteractive /></Box>
   - Always the 2nd child of the root Box, after the header row, on every card.
   - Use '' placeholders (as v1 does) so a sibling appearing or disappearing never shifts its index and remounts the frame.
3. Compact layout (placement === 'inline' or bodyColumns < 36): strip variant, viewBox 0 0 192 24, width="960" height="120" (8:1). No crew, one cloud layer.
4. Airport signs under the banner:
   - A row Box with width="100%" holding N Boxes, each width={`${100/N}%`} alignItems="center", with <Text wrap="truncate-end">.
   - In the SVG, towers sit at cx_i = round((i+0.5)*192/N).
   - Pins and signs line up exactly when the Svg fills the slot (spike S1 and S7).
5. Keep v1's user-approved explicit 20x20 gutter plane only where no banner is drawn (compact). The 26px tag-row plane is dropped when a banner is drawn.

FALLBACKS (in order, chosen by spike S1)
- A) viewBox-only markup, no width/height attributes.
- B) width="100%" on the root <svg>.
- C) Explicit pixels:
  - const PX_PER_CELL = <measured in S1, expected about 7-8.5>
  - width={Math.floor(d.columns*PX_PER_CELL*0.98)}, height={Math.floor(width/4)}
  - It tracks resizes because a width change re-runs render hooks. Only a resize restarts the animation.
- D) If the signs still misalign, draw them inside the SVG with a 3x5 pixel font (about 3 KB).

### animationMechanics

Plain version: the sky picture only gets redrawn when something real happens. Small effects play once and never replay by accident.

1. ONE MOVING PICTURE PER PANE
- The sky banner is the only isInteractive Svg (one sandboxed frame).
- Clouds, plane, captain, crew, confetti, flag stamps and towers all live inside it.
- Boarding passes and chips are Box/Text.

2. DETERMINISTIC SOURCE
- sceneSvg(base, shots) is pure. It must not use now, Date, Math.random or float formatting.
- Coordinates are integers.
- Cloud layout comes from mulberry32(base.seed).

3. MEMO = BYTE STABILITY
- pane.tsx keeps a module Map<string, SceneMemo> keyed `${surface}:${requestId}`.
- nextScene(prev, base, celebrate) returns prev unchanged (same svg and alt strings) when JSON.stringify(base) === prev.key.
- So redraws caused by activity text, 'ago' ticks, countdown seconds, badges, open editors or details/legend pass a byte-identical source and alt.
- Kept out of the base on purpose, because each would restart loops: the time-based 'flying' and 'thinking' poses, activity, clock minutes (the clock is header Text), countdown, edits.

4. ONE-SHOT TRANSITIONS
They are encoded in the new source, are sticky while nothing else changes, and are never replayed.
- glide: when base.at changes, shots.glideFrom = prev.base.at. The plane's outer group is:
  <g transform="translate(x1 y)"><animateTransform attributeName="transform" type="translate" from="x0 y" to="x1 y" dur="1.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>...</g>
- party (confetti plus a flag pop at the last tower): only when live.celebrateUntil > now AND celebrateUntil !== prev.partyId.
- stamp: when tower i flips to 'checked', a flag scale-in plays on it, delayed with begin="1.4s" so it lands after the glide.
- Rule:
  - base equal to the previous base: keep prev.shots (identical string).
  - base different: shots = only the triggers caused by this transition.
- A hot reload clears the Map, so the first draw has no glide. That is harmless.

5. LOOPS (repeatCount="indefinite")
- Two cloud layers translate 0 to -192 over 60s and 36s. Each layer is drawn at x and x+192 for a seamless wrap.
- Plane bob: values="0 0;0 -1;0 0" calcMode="discrete" dur="1.2s" (8-bit hop).
- Propeller: 2 frames via <animate attributeName="visibility" values="visible;hidden" dur="0.2s" calcMode="discrete" repeatCount="indefinite"/>, with frame B using begin="0.1s".
- Contrail: 3 pixels on an opacity loop.
- Star twinkle at sunset.
- Crew: 2-frame wave. A 3-step '...' bubble while a helper works, and a pixel check when it is back.

6. POSES
- ask: holding loop via <animateMotion path="M0 0 a8 3 0 1 0 16 0 a8 3 0 1 0 -16 0" dur="3s" repeatCount="indefinite"/> (inline path, no mpath), plus a blinking '?' bubble from the captain.
- bumpy: discrete shake, values="0 0;1 -1;-1 1;0 1" dur="0.3s", plus a storm cloud with a discrete lightning flash.
- hold/paused: parked on the taxiway at the current tower, with a beacon blink.
- ground (gate): on the runway at the left, with a blinking boarding light.
- landed: parked at the last tower. Confetti only with party.

7. FRAME SWAPS
- Loops: one <g> per frame, with discrete visibility animate.
- One-time reveal: <set attributeName="visibility" to="visible" begin="0.6s"/>.

8. SMIL TO USE AND TO AVOID
- Use (pending S5): animate, animateTransform (translate/scale/rotate, additive="sum" to stack bob and shake), animateMotion with an inline path, set, calcMode discrete/spline, keyTimes/keySplines, numeric begin offsets, fill="freeze".
- Avoid:
  - <script>, on* attributes
  - event or syncbase begins (click, mouseover, a.end)
  - <mpath> and any href until S4 passes
  - <image>, <foreignObject>, external URLs
  - <text> and fonts (use pixel glyphs instead)
  - filters, blur, masks (CPU cost)
  - CSS @keyframes (only :hover is documented)
  - wallclock()

9. TOOLTIPS
- <g><title>Let people log in with Google · 1 of 3 done</title>...tower...</g> on each tower.
- All user or Claude text is XML-escaped (& < > " ').

10. CALM SETTING
- fun = 'calm' draws no Svg, the same as v1.

11. CLIENT SPLIT-FLAP (feasible, gated)
- What the engine gives us:
  - ClientElements (L1409) has no Svg, only Box/Text/etc.
  - surface.every(ms) (L1585).
  - setState (L1568), with the render-loop rule: 3 setState calls in a row with no event in between unmounts the instance (L1565-1566).
  - post() at most once per frame (L1598).
- Build hooks/flap.tsx:
  - props {text}, state {shown, target}.
  - Start every(45) once, while state is undefined.
  - In render, call setState only when state.target !== props.text. New props are an event, so this is not a loop.
  - Each tick: if shown !== target, step each differing char one place through ' 0123456789:APM·abcdefghijklmnopqrstuvwxyz' (about 0.5s total), then setState. Settled ticks do nothing.
  - Draw each char as <Text inverse bold>, separated by spaces.
- Desktop support is hedged:
  - UiMessageArgument.surface reads "terminal, or desktop once it has them" (L14027).
  - "The desktop carries it as data" (L9626).
- Shipping rules:
  - Ship with const FLAP = false.
  - Turn it on only if S6 passes, and even then keep a probe: the module posts {hello:1} on its first tick, and on('ui.message') sets view.flapOk.
  - Until flapOk, the header draws plain Text. A desktop that never paints Client just shows the Text clock.

12. TERMINAL
- No Svg. Draw a 2-line Text strip with the same signs row:
  '☀ 10:42 AM · cruising'
  '🛫 · · ✈ · · o · · o 🛬'
- Optional v2.1: a Raster (L9245) of the same pixel grids using half-blocks, animated by $.ui.blit at about 8fps (L2355-2381) with no redraws.

### architecture

Plain version: new small files draw the art and hold the words. The brain of v1 (model.ts) stays untouched.

STAYS AS IS
- model.ts: untouched.
- contract.ts: unchanged. ROUTE_DESCRIPTION is 1864 chars against a 2048 limit, and an unchanged description keeps the prompt cache and the compliance measured in the spike.
- text.ts: keeps gloss, activityFor and ago.
- All register.tsx behaviour: gate/countdown, deliverEdits fast lane, deny gate, evidence tracking, badges, sounds, persistence.
- Files stay FLAT in hooks/. Only sibling imports were proven in the spike, so a hooks/art/ subfolder is an untested import path.

NEW FILES

hooks/pixels.ts (pure, about 120 lines)
- type Grid = readonly string[] (one char per pixel, '.' = transparent)
- type Palette = Record<string,string>
- gridPaths(grid, palette, dx, dy): string
  - Emits ONE <path fill="#hex" d="M{x} {y}h{w}v1h-{w}z..."/> per color, with horizontal runs merged.
  - About 12 chars per run. A 16x9 plane is about 0.8 KB.
- mulberry32(seed)
- esc(text): XML escape
- Integer-only number formatting.

hooks/art.ts (pure data)
- Sprites:
  - PLANE_A / PLANE_B (16x9, propeller frames)
  - CAPTAIN (3x3 face with a gold-band hat, in the cockpit window)
  - CREW_A / CREW_B (5x7, idle/wave)
  - BUBBLE_DOTS, BUBBLE_Q, CHECK
  - TOWER / TOWER_DONE / TOWER_PROPOSED (7x10), FLAG
  - CLOUD_S, CLOUD_L, STORM
  - SUN, MOON, STAR, RUNWAY tile
- SKIES: 6 palettes (dawn, morning, midday, afternoon, golden, sunset), each with 4 band colors plus ground.
- Ink #1F1A17, cream #F5F0E6, accent #D97757 (Claude orange).
- Moves `Pose` and `GLYPHS` here from sprites.ts (sprites.ts deleted).

hooks/scene.ts (pure, about 300 lines)
- Constants: VW=192, VH=48 (strip: VH=24).
- Types:
  - ScenePose = 'ground'|'air'|'ask'|'bumpy'|'hold'|'landed'
  - AirportState = 'open'|'done'|'checked'|'failed'|'proposed'
  - SceneBase = {v:1; variant:'banner'|'strip'; seed:number; airports:{state:AirportState; tip:string}[]; at:number; pose:ScenePose; sky:0|1|2|3|4|5; crew:{on:number; back:number}}
  - Shots = {glideFrom?:number; party?:boolean; stamp?:number}
  - SceneMemo = {base; key:string; shots; partyId:number; svg:string; alt:string}
- Exports:
  - sceneBase(route, live, variant)
  - nextScene(prev, base, celebrate:{id:number; isOn:boolean})
  - sceneSvg(base, shots), sceneAlt(base)
  - progressOf(route), clockOf(route) returning {minutes, label}
  - airportX(i,n), planeX(route)
  - signOf(feature): the short sign word. Drop leading let/make/add/allow/help/show/keep/build/people/users/the/a/an/so/to/with/and/can, take the first 1-2 words, ≤8 chars, lowercase.
- Layer order:
  1. sky bands (2-row checker dither via a tiny <pattern>, or plain bands if S4 fails)
  2. sun/moon
  3. far clouds
  4. route dots (one <line stroke-dasharray="1 3">)
  5. towers, flags and <title>
  6. near clouds
  7. crew and bubbles
  8. plane (captain, propeller frames, contrail, glide)
  9. confetti
  10. 1px ink frame

hooks/voice.ts (pure)
- export type Voice = 'genz'|'plain'
- type Deck = {tag: Record<Card,string>; chip: Record<ChipKind,string>; phase: Record<ScenePose,string>; hint: {...}; crew:(on,back)=>string; landed:(untested,failing)=>string; toast: {...}; glyph:(surface)=>{plane,check,warn}}
- export const DECKS = {genz, plain} satisfies Record<Voice, Deck>
- COPY moves here from text.ts.
- Rule: voice touches drawn labels, chips, hints, toasts, band and spinner only. It never touches what Claude reads (prompt.submit texts, context strings, GO /^Go: take off/), and button labels stay plain verbs in both voices.
- Example chips (genz / plain):
  - checked: 'receipts ✅' / 'tested ✓'
  - done, not tested: 'done · no receipts yet' / 'done, not tested'
  - Claude says done: 'Claude says done · no proof yet' / 'done, Claude says'
  - failed: 'last test failed 😬' / 'done? last test failed'
  - plane step: 'cruising…' / 'now'
- Example card tags: 'NOW BOARDING' / 'READY FOR TAKEOFF', 'BUMPY AIR' / 'TURBULENCE', 'TOUCHDOWN' / 'LANDED'.

hooks/flap.tsx (optional, FLAP=false)
- The Client split-flap clock described in animationMechanics.

CHANGED FILES

hooks/pane.tsx
- Draw gains voice, surface and scene?: SceneMemo. Elements gains Client?.
- Sections:
  1. header: clock label left, 'step 2 of 7' right
  2. drawSky: keyed Box plus Svg on desktop, 2-line Text strip on terminal
  3. drawSigns: N percent-width boxes. The current sign is bold 'claude'. A checked sign is 'success' with ✓. Done-but-untested is dim.
  4. cardEl: same logic, deck tags and hints, no tag-row plane when a banner is drawn
  5. crew chips: Text backgroundColor 'claude' (on it) or 'success' (back), color 'inverseText', no names, e.g. '2 crew on it · 1 back'
  6. drawPasses (replaces featureRows):
     - The current waypoint is a full boarding pass: borderStyle round, borderColor 'claude'.
     - Pass header: dim bold 'BOARDING PASS · WAYPOINT 2 OF 4'.
     - Title: a plain Button that opens the feature editor.
     - Tear line: Text '┄' repeated (columns-4).
     - Step rows: Box row justifyContent="space-between", holding [tree glyph][glyph or ✈ Text][plain Button title] … [chip Text].
     - Other waypoints are one-line plain-Button stubs, e.g. '✓ [login] Let people log in · 3 of 3 · receipts ✅'.
  7. Editors, badges, decisions, legend and footer: unchanged except copy.
- chipKindOf(step, isPlane) replaces stepChip. It is the single honesty mapping and is exported for tests.
- Card Boxes keep keys card-${kind}.

hooks/register.tsx
- config.voice from options.
- The Pane render hook builds the scene memo (module Map) and passes it in Draw.
- The desktop table adds Client only when FLAP.
- Honest landing: fanfare and celebrateUntil only when every live step is checked or skipped-by-you and tests are not failing. Otherwise a chime and a plain toast.
- Toasts, band and spinner copy come from the deck.
- Optional on('ui.message', {element:'flap'}) sets view.flapOk.

.claude-plugin/plugin.json
- Add userConfig.voice: {type:'string', title:'Voice', description:'How the map talks: a little gen-z, or plain friendly words', options:['genz','plain'], default:'genz'}.
- 'fun': retitle to 'Look' with description 'Pixel skies with animation, or calm text marks'. Keep the values full|calm so saved settings survive.
- Version 2.0.0 at release.

types/index.d.ts
- View.flapOk?: boolean, only if flap ships. No Route or Live change.

tests/: scene.test.ts, voice.test.ts, pane.test.tsx, contract.test.ts. flight.test.tsx switches to key finds.

OPTIONAL LATER (only if derived signs read badly)
- features[].label {type:'string', maxLength:12, description:'set: one word for the airport sign (login).'} in ROUTE_SCHEMA only. ROUTE_DESCRIPTION untouched.
- One line in applySet, plus Feature.label?: string.

BUDGETS
- Scene ≤ 40,000 chars (hard limit 131,072) for every state, including 8 towers, 12 steps, 6 crew and party.
- At most 1 interactive Svg per pane, plus the 20px plane only in compact.
- Per redraw: sceneBase O(steps) plus one JSON.stringify.
- No new timers. The 5s invalidate stays, for 'ago' text only.
- Tree text far under 100,000 chars.
- Alt ≤ 200 chars.

BUILD ORDER
1. Publish v1.
2. Spikes S1-S10.
3. pixels/art/scene plus tests.
4. voice plus tests.
5. pane rewrite plus state-matrix tests.
6. register changes.
7. Live flights in the desktop app (light and dark; narrow and wide; 1, 4 and 8 towers; 12 steps).
8. Docs and screenshots, then v2.0.0.

### stateInputs

Plain version: the clock and sky only move when steps really close. The plane sits on the step Claude is actually on.

Everything comes from atoms the Pane hook already reads. The scene depends on (route, live) and the memo. `now` is used only for the celebrate trigger.

COUNTS
- c = counts(route) (model.ts L77): total (live steps), done (closed = done|checked|skipped), checked, position.

PROGRESS AND CLOCK
- p = total === 0 ? 0 : c.done / c.total. Closed steps only, so nothing advances on a guess.
- 'done, not tested' moves time forward but never triggers a celebration.
- Clock (header Text, NOT in the SVG):
  - minutes = (gate or empty) ? 360 : landed ? 1140 : 360 + round(p*780)
  - label = `${h}:${mm} ${AM|PM} · ${deck.phase[scenePose]}`
  - Examples: '6:00 AM · boarding', '10:42 AM · cruising', '7:00 PM · touchdown'.

SKY (in SceneBase)
- gate or empty → 0 (dawn)
- landed → 5 (sunset)
- otherwise 1 + min(3, floor(p*4)): morning, midday, afternoon, golden hour.

SCENE POSE (coarse on purpose)
- route null/empty, or gate waiting|held → 'ground'
- landedAt > 0 → 'landed'
- live.waiting → 'ask'
- live.failedRuns ≥ 2 || live.errorsInRow ≥ 3 → 'bumpy'
- !live.isRunning → 'hold' (covers holding and paused)
- otherwise 'air'
- poseOf() stays for the Text glyph, the band and the compact gutter plane.

AIRPORTS
- Which features: those with ≥1 live step, or proposedBy 'you' (N ≤ 8).
- State of each, checked in this order:
  1. proposed
  2. failed (any step failed)
  3. checked (all live steps checked or skipped-by-you)
  4. done (all closed)
  5. open
- tip = `${title} · ${closed} of ${m} done` (escaped).

PLANE X (integer viewBox px, sprite 16 wide)
- cx_i = round((i+0.5)*192/N)
- ground/empty → 4
- landed → cx_{N-1} - 20
- otherwise:
  - i = feature of route.plane
  - L = that feature's live steps, m = L.length
  - k = index of the plane step in L (0 if missing)
  - prev = i === 0 ? 8 : cx_{i-1}
  - x = round(prev + (k+0.5)/m*(cx_i - prev)) - 8
- y = 14 in the air, 31 on the ground.
- This is monotone because the model never pulls the plane back over seen work.

CREW
- on = min(3, live.helpers.filter(h => !h.isDone).length)
- back = min(3, live.helpers.filter(h => h.isDone).length)
- Descriptions never reach the scene or the chips (no names).

SEED
- route.setAt % 9973: per-flight cloud layout, stable within a flight.

CELEBRATE
- {id: live.celebrateUntil, isOn: live.celebrateUntil > now}
- party fires once, only when id !== memo.partyId.
- v1 sets celebrateUntil only on verified checks. v2 also gates landing on all-verified.

STABILITY CONTRACT
The source and alt change only when:
- the closed count crosses a sky bucket
- the plane's step changes
- an airport state or tip changes
- the scene pose changes
- crew counts change
- a one-shot fires

Activity, ago, countdown seconds, edit badges, open editors, details/legend toggles, cost and clock minutes never change them.

ALT
- sceneAlt(base), e.g. 'Sky map: the plane is between "log in" and "tests"; 1 of 4 airports reached; 2 crew on it.'

OPTIONAL (honest) FINER CLOCK
- Add 0.5 × (observed written files / declared files) of the active step. Only observed writes count.

### tests

Plain version: tests prove the art is identical every time, small enough, safe, honest, and works in both voices on desktop and terminal.

Keep all 37. Add about 16. Every UI assertion finds keys, not words, so copy changes never break tests.

tests/scene.test.ts (pure)
1. Determinism:
   - sceneSvg(base, shots) called twice gives identical output.
   - nextScene(undefined, base) from two fresh memos gives identical svg and alt.
   - sceneBase() is identical for Live objects that differ only in activity, activityAt, lastCommand, cost or contextPercent.
2. Size and safety matrix. Loop over:
   - N 0..8
   - all 6 poses
   - sky 0..5
   - crew on/back 0..3
   - shots {} and {glideFrom, party, stamp}
   - banner and strip
   - plus an 8-feature, 12-step route (the schema maxima) with 60-char titles
   Assert for each:
   - length < 131072, and ≤ 40000 as the budget
   - starts with '<svg xmlns="http://www.w3.org/2000/svg"'
   - no /<script|\son[a-z]+=|<image|<foreignObject|href=|NaN|undefined/
   - tags balance (a stack parser over /<\/?([a-zA-Z]+)[^>]*?(\/?)>/g)
3. Escaping: a title '</svg><script>&"' appears only in escaped form.
4. One-shots:
   - a plane step change sets glideFrom = prev.base.at
   - the same base again returns the identical memo (svg ===)
   - a crew-only change drops the glide
   - a repeated celebrate id gives no second party
   - stamp fires only on open→checked
5. Honesty:
   - progressOf counts closed steps only
   - clockOf at the gate = '6:00 AM', landed = '7:00 PM'
   - planeX never decreases across a scripted flight
6. Alignment: airportX(i,n) === round((i+0.5)*192/n) for n 1..8.

tests/voice.test.ts
7. Both decks have identical key sets at every depth (recursive). No empty strings. Every function returns non-empty for inputs 0..3 × 0..3.
8. 'receipts' appears only in chip.checked. The plain deck has no emoji outside the allowed set ✈ ✓ ⚑ (\p{Extended_Pictographic}).
9. Every chip is ≤ 30 chars.

tests/pane.test.tsx (claude-code/testing)
Loop over ['terminal','desktop'] as const × options {voice:'genz'} / {voice:'plain'} using test(name, {options}, body).
10. Every pane state validates:
    - States: empty, ready, held, now, ask, turbulence, holding, paused, landed-verified, landed-untested.
    - ask: assert inside a test-side AskUserQuestion tool.call hook while the call is open.
    - turbulence: 3 failing Bash results, mocked.
    - Each mount: drawn root type is 'Box', and find({key:`card-${state}`}) is defined. The key proves our tree drew, not the engine's fallback.
    - landed-untested: register set no celebrate, and the svg has no confetti group id.
11. Tree rules (recursive walk of ui.drawn()):
    - no Svg under any Button
    - terminal trees have 0 Svg
    - desktop, not compact: exactly 1 Svg, with no width/height props and a non-empty alt
    - desktop compact: ≤ 1 Svg
    - options {fun:'calm'}: 0 Svg
12. Byte stability through the real hooks: draw, press 'details', make a Read tool call (activity changes). The banner source and alt must be === the first draw's.
13. bodyColumns 30, 58 and 100, plus placement inline: every state validates, and the signs row has N children.
14. Voice never reaches Claude: takeoff submits text matching /^Go: take off/ in both voices, and the delivered edit context is identical in both.

tests/contract.test.ts
15. ROUTE_DESCRIPTION.length < 2048 (now 1864). JSON.stringify(ROUTE_SCHEMA).length < 65536. ROUTE_TOOL === 'route'.

tests/flight.test.tsx
16. Replace find({text:/READY FOR TAKEOFF|LANDED|NOW|ON THE GROUND/}) with the card keys. Keep the '"type":"Svg"' presence check.

Optional (only if FLAP ships)
- Mount desktop, then ui.advance(600): the flap Client text equals the target.
- A further advance produces no new draw.
- ui.post({hello:1}) sets flapOk.

Run with: claude plugin test ~/Projects/flightplan

### spikeChecks

Plain version: before building, run 10 quick experiments in the real app to see what the engine actually does.

HOW
- Work on branch v2-lab, never committed to main.
- Add `case 'lab'` to /flight. It opens $.ui.open({id:'flightplan-lab', title:'FP lab'}).
- Add a ui.render hook matching requestId 'flightplan-lab' that draws the variants below. While the lab is open, run $.clock.every(1000, () => $.ui.invalidate('ui.render')).
- The folder hot-reloads (or run /reload-plugins). Run /flight lab in the desktop app, look, and screenshot.
- Write the results into docs/spike-results.md §6 before writing pane.tsx.

S1. SVG FILL (decides sizing)
- Three stacked Svgs, with no width/height props:
  - (a) viewBox 0 0 192 48 plus width="960" height="240"
  - (b) viewBox only
  - (c) width="100%" height="auto"
- Each draws a 1px frame and a ruler with ticks every 16 units. Also draw `bodyColumns` as Text.
- PASS: one variant spans the pane edge to edge at 4:1 with no crop, both at about 35 columns and in a wide dock, and still after dragging the pane wider.
- Record the px width ÷ bodyColumns → PX_PER_CELL for fallback C.

S2. ANIMATION SURVIVES REDRAWS (decides the whole plan)
- A byte-identical Svg with a 10s linear sweep bar, under a Text that changes every second.
- PASS: the bar never jumps back.
- Then repeat while:
  - (b) changing only alt each second
  - (c) toggling a sibling Box above it (proves the '' placeholder rule)

S3. PIXEL LOOK AND THEME
- shape-rendering="crispEdges" at non-integer scale: check for seams or blur.
- Check the banner in the light and dark app themes.
- Test <style>@media (prefers-color-scheme: dark){.sky{opacity:.85}}</style>: does it follow the app theme?

S4. WHAT THE SCRUB KEEPS
- <defs><g id="c">…</g></defs><use href="#c" x="40"/>, plus an xlink:href variant
- <pattern> fill
- a <title> tooltip on hover
- a CSS :hover rule
- If any fail: inline the repeats, use plain bands, drop :hover.

S5. SMIL VOCABULARY
- discrete visibility swap at 0.2s
- spline glide with fill="freeze"
- animateMotion with an inline path
- <set>
- begin offsets
- additive="sum"
- PASS: everything moves as authored.

S6. CLIENT ON DESKTOP
- A lab Client module counts with every(100) and posts {hello:1} on its first tick. A ui.message hook toasts 'hello'.
- PASS: the count animates in the pane AND the toast shows.
- FAIL: keep FLAP=false (Text clock).

S7. SIGNS ALIGNMENT
- Banner plus a row of N Boxes width={`${100/N}%`} with centered '[label]' Text, for N = 3, 5 and 8.
- PASS: labels sit under the towers within ±1 char at narrow and wide sizes.
- FAIL: pixel-font signs inside the SVG.

S8. CHIPS AND EMOJI
- Text backgroundColor 'success' and 'claude' with color 'inverseText', both inside a plain Button and alone.
- ✅ 😬 🎟 ☀ ✈ in Text and in Buttons on desktop.

S9. COST
- A real 6-step flight with the full banner animating.
- Activity Monitor: the Claude renderer at idle should stay at or below about 5-8% CPU.
- If higher: halve the clouds, freeze the far layer, lengthen durations.

S10. HOVER POLISH (optional)
- Keyed boarding-pass row with hover backgroundColor (BoxHoverProps L878).
- A 'why' line drawn display "none" with hover {display:'flex'}.
- Does it look fine on desktop?

### risks

Plain version: the biggest unknown is whether the picture restarts every time the panel refreshes. We test that first and have a fallback for every risk.

1. ANIMATIONS RESTART ON EVERY PANE REDRAW (S2 fails)
- The pane redraws on every tool call (live.activity), so clouds and glides would jitter.
- If only structural changes restart it: the keyed Box plus '' placeholders already fix that.
- If every redraw restarts it: ship the banner as a static picture (no isInteractive), put motion in Text (flap clock, ✈ glyph steps), and keep isInteractive only on rarely-redrawn cards (ready, landed).

2. SIZING (S1)
- The banner may crop or not fill the width. Fallbacks A-D, ending in explicit pixels from the measured code-font advance.

3. CPU / TOO MANY FRAMES
- One interactive Svg per pane.
- Durations ≥ 0.2s.
- No filters or masks.
- The calm setting.
- Measure in S9.

4. LIGHT/DARK
- SVG hex colors don't follow the theme. The banner is a self-contained window with its own sky and a 1px ink frame, in muted palettes.
- Optional prefers-color-scheme style if S3 shows it works.
- Box/Text use theme keys only.

5. CLIENT ON DESKTOP IS HEDGED (L14027 'desktop once it has them', L9626)
- FLAP off by default.
- Hello probe.
- Text fallback.

6. PLAYFUL COPY BENDING HONESTY
- One chipKindOf mapping.
- 'receipts' only for checked (a test the map saw pass).
- Landing confetti and fanfare only when everything is verified; otherwise 'landed · 2 still need receipts'.
- Tests 5, 8 and 10 enforce it.

7. VOICE LEAKING INTO WHAT CLAUDE READS
- That would break GO /^Go: take off/, acks, and the compliance measured in the spike.
- The deck is used for drawing and toasts only (test 14).

8. GEN-Z COPY THAT IS CRINGE OR UNCLEAR
- The plain voice setting.
- Buttons stay plain verbs in both voices.
- Chips ≤ 30 chars.
- One human copy review.

9. EMOJI WIDTH BREAKS TERMINAL ALIGNMENT
- deck.glyph(surface) gives an ASCII set on the terminal.

10. WORDING CHANGES BREAK TESTS
- Key-based finds.

11. VALIDATOR RULE ($ only into top-level hooks-file functions)
- scene, voice and pixels never take $. The memo Map lives in pane glue.

12. HOT RELOAD CLEARS THE MEMO
- The first draw after a reload has no glide. Harmless.

13. SUBFOLDER IMPORTS ARE UNTESTED
- Flat files in hooks/.

14. TEXT BUDGET AND ALT STABILITY
- Alt ≤ 200 chars and built from the same base as the source.

15. PROMPT-CACHE OR COMPLIANCE REGRESSION
- ROUTE_DESCRIPTION untouched. The optional label goes in the schema only.

16. PUBLIC REPO HYGIENE
- docs/spike-results.md names the work account used for the spike and the spike spend.
- Choose the LICENSE holder.
- Renaming the marketplace breaks the local install until it is re-added.
- The public marketplace name must be final before the first push, because renaming later breaks everyone's installs.

### githubV1

Plain version: tidy 5 small files, save a snapshot, the user logs in to GitHub once, then one command creates the public repo and a v1.0.0 release.

0. ASK THE USER FIRST
- LICENSE copyright holder: you personally (e.g. 'Aravinth (aravinth01)'), or the company? plugin.json author is currently the company.
- Are you OK publishing docs/spike-results.md as-is? It names the work account used for the spike and the $3.30 spike spend.
- Confirm: publishing makes the repo public.

1. VERSION
- .claude-plugin/plugin.json: "version": "0.1.0" → "1.0.0".
- Optionally add "license": "MIT" and "repository": "https://github.com/aravinth01/flightplan". Keep them only if `claude plugin validate` accepts them.

2. MARKETPLACE NAME
- .claude-plugin/marketplace.json: "name": "flightplan-local" → "flightplan". 'local' reads wrong in public, and the name must be right before the first push.
- Plugin entry stays {"name":"flightplan","source":"./"}.
- Re-point this Mac's dev install afterwards (check `claude plugin --help` for exact verbs):
  - claude plugin uninstall flightplan@flightplan-local
  - claude plugin marketplace remove flightplan-local
  - claude plugin marketplace add ~/Projects/flightplan
  - claude plugin install flightplan@flightplan --scope user
- Hot-editing from the folder keeps working.

3. LICENSE
- Add LICENSE with standard MIT text, 'Copyright (c) 2026 <holder from step 0>'.

4. README
- Replace "## Install (this Mac)" with "## Install":
  - Type this in a TERMINAL Claude Code session (the desktop app's Code tab doesn't take /plugin):
    /plugin install flightplan --marketplace aravinth01/flightplan
  - Answer y to add the marketplace and pick the User scope.
  - New desktop sessions load it from then on.
- Move the folder install into "## Developing", using flightplan@flightplan.
- Delete the 'To share it with your team later…' paragraph.
- Add "## License: MIT, see LICENSE".

5. .gitignore
- Keep: .claude-plugin/types/, tsconfig.json, .DS_Store (engine-laid typings and local files).
- Add: node_modules/, *.log, flightplan-spike-log.json, .env*
- Exclude FLIGHTPLAN_LOG output files.
- Nothing else needs excluding. Ship: .claude-plugin/, hooks/, types/, tests/, fx/ (4 wav files, about 115 KB), docs/, README.md, LICENSE, .gitignore.

6. CHECK
- claude plugin validate ~/Projects/flightplan
- claude plugin test ~/Projects/flightplan (expect 37 passing)

7. FIRST COMMIT (not a git repo yet; global user is aravinth01 with the noreply email)
- git -C ~/Projects/flightplan init -b main
- git -C ~/Projects/flightplan add -A
- git -C ~/Projects/flightplan status --short   ← review: no .DS_Store, tsconfig or logs
- git -C ~/Projects/flightplan commit -m "Flight Plan v1.0.0: a live flight-plan map of what Claude is doing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

8. LOGIN (the user does this; Claude cannot enter credentials)
- gh auth login → GitHub.com → HTTPS → answer Yes to authenticate Git → Login with a web browser.
- Check with: gh auth status

9. CREATE AND PUSH
- gh repo create aravinth01/flightplan --public --source ~/Projects/flightplan --remote origin --push --description "A live flight-plan map of what Claude is doing, beside the chat in the Claude desktop app"

10. TAG
- git -C ~/Projects/flightplan tag -a v1.0.0 -m "Flight Plan v1.0.0"
- git -C ~/Projects/flightplan push origin v1.0.0

11. RELEASE
- gh release create v1.0.0 --repo aravinth01/flightplan --title "Flight Plan v1.0.0" --notes "<notes>"
- Notes should say:
  - First public release.
  - What it does: a route of waypoints and steps, a plane on the current step, click-to-change steps and decisions, a departure countdown you can hold, honest test-evidence marks, sounds, a /flight command.
  - Install line: /plugin install flightplan --marketplace aravinth01/flightplan (from a terminal session).
  - Built and tested on Claude Code 2.1.295 with the macOS desktop app. The terminal shows text marks.

12. OPTIONAL TOPICS
- gh repo edit aravinth01/flightplan --add-topic claude-code --add-topic claude-code-plugin

13. VERIFY
- gh repo view aravinth01/flightplan --json visibility,url
- gh release view v1.0.0 --repo aravinth01/flightplan
- gh api repos/aravinth01/flightplan/contents/.claude-plugin/marketplace.json → must exist at the repo root's .claude-plugin/.
- Optionally run the install line on another machine.

14. THEN START V2 ON A BRANCH
- git -C ~/Projects/flightplan switch -c v2-pixel-skies
- Spikes go on v2-lab, which is never merged.
- v2 ships as a PR plus tag v2.0.0, with plugin.json version 2.0.0.

## 4. Critic: conflicts, resolutions, cuts, phasing

### conflicts

- C1 CLOCK LABEL PLACEMENT: Art draws the clock tag ('10:42 AM · CRUISING') inside the Svg in a pixel font. Its word changes on time-based states: COOKING after 5 s of silence, STILL ON IT after a 20 s tool call, the 60 s '+N NEW' tag. Each change gives the Svg a new source, which restarts every loop. Engine keeps the clock out of the Svg as header Text. Copy's phrase 'receipts ✅' contains an emoji that a 3x5 pixel font cannot draw.
- C2 THREE CLOCK FORMULAS: Art runs 6:00 AM to 6:00 PM, adds 0.5 for the active step, and uses landed 6:48 PM, ground 5:30, boarding 5:45. Copy uses 6:00 + 780 × done/total, landed 7:00 PM, gate 5:45, plus an optional 9 PM 'parked for the night' after 10 real minutes. Engine puts the gate at 6:00 AM and landed at 7:00 PM. Art's +0.5 contradicts Copy's 'moves only when a step closes'. Copy's 9 PM contradicts 'never moves just because time passed'.
- C3 WHAT A PIN MEANS, AND WHERE LABELS LIVE: Art spaces pins by step count and makes a pin the START of its leg, yet Art's own boarding pass reads 'FROM IDEA ✈ TO LOGIN', which treats the pin as the destination. Engine spaces towers evenly with the plane flying toward tower i. Art's labels are pixel-font tags inside the Svg, sanitized to A-Z0-9 and 7 chars, so non-Latin titles become 'STOP n'. Engine's labels are a percent-width Text row, which needs even spacing and is unverified (S7).
- C4 ONE-SHOT MECHANISM: Art derives glide, stamp and landing from state timestamps plus a window, then drops each with an invalidate. That needs new state fields. Engine derives them from render history (prev memo base) and keeps them sticky with 'no Route/Live change'. Engine's version is non-deterministic across surfaces, hot reloads and pane remounts, and replays confetti whenever the frame remounts. Art bakes the cloud phase from `now` on a cache miss, which breaks Engine's 'sceneSvg is pure' determinism test. Also, v1 schedules the 1600 ms invalidate only after seeWrite moves (register.tsx L660), never after a route `step start` move.
- C5 ENGINE'S CONFETTI TRIGGER BREAKS HONESTY: Engine fires party when live.celebrateUntil changes. v1 sets celebrateUntil on every mid-flight test check (register.tsx L564, L681) and on EVERY landing (L768). It also plays fanfare and toasts 'every step on the route is done' on untested or failing landings (L767-771). Wired as Engine proposes, confetti would play mid-flight and on landings nobody verified.
- C6 NO SHARED 'VERIFIED' PREDICATE: v1 pane isAllChecked counts checked or ANY skipped (pane.tsx L425). The v1 chime needs all 'checked', skipped excluded (register.tsx L688). Art's party is checked-or-skipped plus a green last run. Copy's 'we ate' is every step checked with 0 failing, and 'you checked it' never gets ✅. Nobody decides whether user-vouched or Claude-skipped steps may earn confetti, or what happens when route.tests is null (no test ever ran).
- C7 'THE PLANE NEVER GOES BACK' IS FALSE: Engine claims planeX is monotone and tests 'planeX never decreases'. model.ts moveTo allows backward moves for a redo, a failed step, or when everything in between is closed. Art designs a U-turn for exactly this. Engine's test would fail on a redo flight.
- C8 SVG COUNT: Art keeps the banner AND an animated 22x12 gutter plane Svg in the list (2 sandboxed frames), while its own motion rule 9 says 'the list stays still'. Engine allows 1 Svg, but contradicts itself on compact: a strip banner there AND v1's 20 px gutter plane 'only where no banner is drawn'.
- C9 GEOMETRY, SPRITES AND PALETTE: Art uses viewBox W∈{160,240,300} × H 72 (dock) or 36 (strip), a 26x13 plane, 10x14 captain and 8x13 crew. Engine uses 192×48 (4:1) with a 16x9 plane, 3x3 captain and 5x7 crew. 48 units cannot stack Art's ground strip (13u crew, 14u captain, towers) under pins, plane and clouds. There are three inks in play: Art #2B1D16, Engine #1F1A17, v1 #3B2A22.
- C10 TIME-BASED AND MISMATCHED SCENE STATES: Art's thinking bubble (5 s silence) and long-haul hourglass (20 s tool) are time-based, so they churn the source. Engine's 'bumpy' scene uses poseOf's threshold, failedRuns≥2 OR errorsInRow≥3. Three ordinary tool errors (a missing file) would draw a storm and 'BUMPY AIR' while the card still says cruising (the card needs failedRuns≥3).
- C11 CALM SETTING: Art makes calm a static Svg and adds a 3rd value 'text'. Copy and Engine keep calm = no Svg, as in v1. The new title differs too: Copy 'Animations', Engine 'Look'.
- C12 VOICE SETTING SHAPE: Copy uses userConfig voice fun|plain, a per-key DECK {fun, plain} in text.ts, a View mirror, a footer toggle and '/flight voice'. Engine uses voice genz|plain, a typed DECKS object in a new voice.ts, config only, and 'no Route/Live change'. Copy's deck has about 250 keys, too many for one pass.
- C13 EMOJI BUDGET: Copy allows only ✈️ ✅ 🎟, in the fun voice, on desktop, at most one per line, never in tags, buttons or alt text. Art uses 🎉 👀 ✋ ⛑ 🎃 ✨ 🎂. Engine uses 😬 in a chip and 🛫 🛬 in the TERMINAL strip, which contradicts Engine's own risk #9 (emoji width breaks terminal alignment). Art's dot leaders ('·' repeated to fill bodyColumns minus widths) also miscount emoji and wide characters.
- C14 SLANG OUTSIDE COPY'S ALLOWED LIST: Art writes 'COOKING / let it cook' (Copy bans 'cooked'), 'YOUR CALL', 'CIRCLING', 'no stress' and 'TEST SAID NOPE' (Copy allows 'nope' only in 'tests say nope'). For a landing with untested steps, Copy's fun tag is 'TOUCHDOWN'; Art's quiet landing deliberately avoids it ('LANDED').
- C15 THE NOUN: Copy replaces feature and waypoint with 'stop' everywhere the user looks (NOUN_STOP). The user-approved preview and Art say 'waypoint 2 of 4'. v1 has an 'Add a feature' button.
- C16 CONTRACT CHANGE: Copy rewrites ROUTE_DESCRIPTION's wording paragraph (verified current length 1,864 → 2,011 of 2,048) and adds a feature `pin` schema field. Its pasted text even carries a double space it asks someone to fix. Engine keeps ROUTE_DESCRIPTION byte-identical for the prompt cache and the measured compliance, with an optional `label` field later.
- C17 HELPER (CREW) DATA AND CHIPS: Copy needs helpers.isError/isDenied/startedAt/doneAt, rows kept 30 s, 'still at it' after 60 s, and descriptions shown. Engine says descriptions never reach chips ('2 crew on it · 1 back'). Art caps at 3 rows plus '+N more', Copy at 4. v1 drops finished helpers on the next dispatch and clears all of them at turn end.
- C18 CLIENT SPLIT-FLAP: Engine proposes a Client clock. The types hedge desktop support ('desktop once it has them'). The Client table has no Svg. Its module path must be a literal the engine reads from the hooks module's source, and pane.tsx is an imported file, so that is unverified. Three setState calls in a row with no event in between unmount it.
- C19 PANE ORDER: Engine pins the banner as the 2nd child, after the header. Art's mockups and the user's preview put the sky first, with the clock on its top edge.
- C20 TESTS: Engine rewrites the flight tests to key finds and asserts 'no width/height props on the banner Svg', which breaks if spike S1 picks explicit pixels (fallback C). Copy instead runs the existing tests with { voice: 'plain' }, since plain keeps v1's words.
- C21 SIZE BUDGET: Art caps the scene at 32 KB (test-enforced); Engine at 40 KB.
- C22 MARKUP SAFETY: Art puts feature titles in pin <title> tags without saying they are XML-escaped. Claude writes those titles, so they are untrusted text inside SVG markup.
- C23 SVG HEIGHT VS PANE ROWS: a 110-140 px banner sits in a scroll window counted in cells (bodyRows). v1 only ever drew 20 px icons. No design checks that siblings are not overlapped, or that scrolling works with an editor open.
- C24 IDLE CPU: Art's holding (racetrack plus clouds forever) and landed (runway chase forever) keep animating while the user is away. Engine's S9 only measures a busy flight.
- C25 GITHUB V1 PLAN vs USER REQUEST: the user said 'push this to github as v1'; Engine's plan assumes --public. Verified: gh is not logged in, and the git identity is aravinth01 with the noreply email. docs/spike-results.md names the work account used for the spike and the $3.30 spend. plugin.json author is the company. Renaming the marketplace breaks this Mac's local install until it is re-pointed.

### resolutions

- R1: No words inside the Svg. The clock is a Text row at the top of a keyed 'sky' Box: <Text inverse color='claude'> ☀ 10:20 AM </Text> plus a bold phrase from Copy's table, voiced and allowed to carry ✅. This matches the user's preview (clock on the sky's top edge). Time-based phrases (thinking, receipts 2.5 s, route grew 60 s) then only redraw cheap Text, and the Svg source stays byte-identical.
- R2: One clockOf(route, card) in scene.ts, unit-tested. In the air: minutes = 360 + floor(780 × done/total), capped at 1120 (6:40 PM). It counts CLOSED steps only, with no +0.5. Fixed times: empty 5:30 AM, gate 5:45 AM, landed 7:00 PM. No 9 PM night. Sky bucket comes from minutes, using Art's palettes: predawn <6:00, dawn 6-7:59, morning 8-10:59, noon 11-1:59, afternoon 2-4:29, golden 4:30-6:39, dusk = landed. It rewinds when the route grows (v1's '+N new' in the bar says why).
- R3: Pins are destinations, evenly spaced. pin_i = X0 + (i+0.5)·(X1−X0)/N. The plane on step k of m in leg i sits at prev + (k+0.5)/m·(pin_i − prev), where prev = R0 (end of takeoff roll) for i=0. This matches FROM prev ✈ TO this on the pass. Labels go in a Text signs row: a left spacer Box `${X0/W*100}%`, then N centered Boxes `${(X1−X0)/W/N*100}%` with wrap='truncate-end'. The current label is bold claude, a checked one success. Words come from signOf(title) (drop leading let/make/add/the…, ≤8 chars), so any script works. If S7 misaligns by more than 1 cell, drop the row: pins keep <title> tooltips and passes show FROM/TO. Never build a pixel font.
- R4: Use Art's state-derived approach, made pure. sceneKey(route, live, now, columns, placement) adds a one-shot only while now − eventAt < window. Every event time is persisted: route.movedAt + new route.planeFrom (glide/U-turn), new route.takeoffAt, new step.checkedAt (set only by seeTestRun/applyStep's seen pass, never by 'I checked it'), and route.landedAt. Cloud phase = ((eventAt or eventAt+window)/1000 × speed) mod W, read from the key's own times and never from `now`, so sceneSvg stays pure. The memo is a plain 24-entry LRU on JSON.stringify(key). register.tsx calls $.clock.after(window+50, () => $.ui.invalidate('ui.render')) at every site that records an event: seeWrite move, route step start/finish, test check, takeoff, landing. This also fixes the missing invalidate after `step start`. Nothing sticks, so a remount never replays a celebration.
- R5: Split the channels. The receipts stamp comes only from step.checkedAt. Confetti, the cheer and the fanfare come only from landingOf(route) === 'party' && now − landedAt < 6000. turn.complete: party gets fanfare and the 'we ate' toast; quiet gets a chime and 'landed, N steps still need receipts'; amber gets no sound and a toast naming the failing count. live.celebrateUntil stays only for v1's terminal/band glyph pose and never reaches the scene.
- R6: Put one predicate pair in model.ts, unit-tested as a matrix. hasReceipts(step) = status 'checked' && doneBy !== 'you'. landingOf(route): 'amber' if route.tests?.failed > 0 or any live step is 'failed'. 'party' if every live step is checked or skipped-by-you, AND at least one step hasReceipts, AND no step was skipped by Claude. Otherwise 'quiet'. The party headline says 'every step has receipts' only when every checked step hasReceipts; otherwise 'every step checked (2 by you)'. The waypoint chime and green flag use the same rule per feature, so pane and register agree.
- R7: Delete the monotone test. Replace it with: planeT decreases only when model.moveTo's rework rule allows it (target failed, or has the redo note), and then the key marks a U-turn. Keep Art's cheap U-turn: a discrete scale(-1 1) at the start of the glide and back at its end.
- R8: Exactly one Svg per pane: the banner on dock, a strip on inline/compact, none on terminal or calm (v1 glyphs there). The plane's step in the list shows a static ✈ Text in claude. No gutter Svg anywhere. Test: count Svg ≤ 1, none under a Button.
- R9: Adopt Art's geometry (W bracket by bodyColumns, H 72 dock / 36 strip), Art's grids, Art's toPaths run-merge and Art's palette (ink #2B1D16, cream #FFF4E0, orange #D97757). Retire Engine's 192×48. S1 picks auto-size or explicit width. S3 decides whether to force an integer px-per-unit width from a measured PX_PER_CELL, if non-integer crispEdges shows uneven pixels.
- R10: Scene poses come from state only: ground, boarding, air, ask, holding, paused, chop (poseOf turbulence: plane wobble only, no words), storm (card turbulence = failedRuns≥3: cloud, rain, bolt), and landed-party/quiet/amber. Thinking and long-haul stay in the deck card's activity Text ('✻ thinking it over'). Weather words follow the card, so tool errors alone never say 'bumpy air'.
- R11: Keep the userConfig values full|calm so saved settings survive. calm = no Svg (v1, Copy and Engine agree). Retitle it 'Animations', described 'Pixel sky with animation, or calm text marks'. Emit every animate through one anim() helper, so a later 'still' option is a one-flag add.
- R12: Copy's data shape wins. One table WORDS: Record<Key, {fun, plain}> in hooks/text.ts, read through say(key, voice, vars), so both variants sit side by side and can't drift. userConfig voice options ['fun','plain'], default 'fun', title 'Words'. Config only: a change reloads the module and redraws. No View field, footer toggle or /flight voice in v2.0. Voice ~60 user-facing keys only: card tags, headlines, hints, step/stop chips, captain/crew chips, clock phrases, landing lines, check/landing toasts, band, legend. Everything else stays shared plain strings. Test that voice never touches the Go: prompt, deliverEdits text or context strings.
- R13: Copy's emoji budget is law. Only ✈️ ✅ 🎟, fun voice, desktop only, at most one per line, never in tags, buttons, alt or the Svg. Remove 🎉 👀 ✋ ⛑ 😬 🛫 🛬 and all seasonal emoji. The terminal swaps ✅→✓ and drops the others. Replace dot leaders with justifyContent='space-between' rows. Test the allow-list with \p{Extended_Pictographic} per surface.
- R14: Copy's deck is the only source of words; Art's strings are layout placeholders. COOKING→'thinking it over', YOUR CALL→'your turn', CIRCLING→'holding pattern', 'test said nope'→'tests say nope', drop 'no stress'. TOUCHDOWN is the tag only on a party landing; quiet and amber say LANDED.
- R15: One constant NOUN_STOP = 'stop', because the user's 'every step in layman' outranks the preview's wording. 'Add a feature'→'Add a stop'. The pass header reads 'BOARDING PASS · stop 2 of 4'; the departure line reads '4 stops'. The Claude-facing contract keeps 'waypoints (features)'. The lead should tell the user this one word changed from the approved preview.
- R16: ROUTE_DESCRIPTION and ROUTE_SCHEMA stay byte-identical in v2.0, for the prompt cache and the measured compliance. signOf() derives pin words. Add an optional feature `label` to the schema only if live flights show bad signs.
- R17: Small Live change only (Live is not persisted): helpers gain startedAt, doneAt and isError. Rows read 'crew · {chip} · {Claude's description}' (plain: 'helper ·'). v1 already shows descriptions, and they are Claude's words, not names. Chips: on it / still at it (≥60 s, Text only) / reported back / hit a snag. At most 3 rows, then '+N more crew'. Keep v1's clear at turn end. The scene gets only crew variant (dispatch index mod 3) and phase work|back. Crew never get ✅.
- R18: Cut the Client split-flap and spike S6 entirely; the clock is plain Text.
- R19: Root order: the keyed 'sky' Box comes first (clock row, Svg, signs row), then goal/step header, bar, deck card, route. As the first child its index never shifts. Keep v1's '' placeholders elsewhere.
- R20: Do both. The 3 existing flight tests run with { options: { voice: 'plain' } } (plain keeps ON THE GROUND / READY FOR TAKEOFF / NOW / LANDED / queued). New tests find by key (card-${kind}, sky). The Svg size-prop assertion reads the SIZING constant S1 chose. Add one fun-voice flight: IN THE AIR, 'receipts ✅' on a seen check, and no 'we ate' on a quiet landing.
- R21: 32 KB cap, test-enforced over poses × 3 widths × crew 0-3 × one-shots × 1/4/8 stops × 60-char titles. The test also requires no NaN, undefined, <script, on*=, href= or <text>, and balanced tags. Keep Art's element caps.
- R22: Every Claude or user string entering markup goes through esc(); titles appear only inside <title>. Test with the title '</svg><script>&"'. Alt text is built from the key (no time-based words), is not voiced, and stays ≤200 chars.
- R23: Add to S1: measure the banner's row footprint, check that siblings below are not overlapped, and check scrolling with an editor open. If the desktop counts the Svg as one row, pass an explicit height.
- R24: Idle states (holding, paused, landed after its window, empty) run at most 2 slow loops: clouds at 1u/s or static, plus a beacon. The racetrack runs only in 'ask', which is bounded by the user answering. S9 measures CPU on an idle pane over 10 minutes as well as during a busy flight; if it is over budget, holding parks the plane.
- R25: Before pushing, the lead asks the user three things: public or private (default --private if unanswered, since public is hard to undo), the LICENSE holder (aravinth01 or the company, to match plugin.json author), and whether docs/spike-results.md may be published as-is. The user runs `gh auth login` themselves. Rename the marketplace to 'flightplan' before the first push, then re-point the local install. Commit with the required 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>' line.

### cuts

- Client split-flap clock (hooks/flap.tsx, FLAP flag, View.flapOk, spike S6): the clock is plain Text.
- All pixel-font text inside the Svg: the clock tag, pin label tags, departure-board text, 'II PAUSED' words, the 'RECEIPTS ✓' text stamp, the '+N NEW' tag, the 'YOUR CALL?' speech. Replace them with Text rows and icon sprites: a green check badge, an II bars sprite, a ? bubble.
- The whole seasonal pack: Halloween, Diwali, Winter, New Year, the plane's birthday ($.store firstFlightAt), the Friday copy, red-eye flights. Also the night palette, stars, city lights and the 9 PM 'parked for the night'. Candidate for v2.1: a Halloween-only pack (pumpkin bunting, bats, witch hat), since Oct 24-31 is next week.
- Waypoint fireworks rockets. Keep the pin flipping to the green flag, a static gold sparkle, and the chime.
- Cockpit-cam inset with the waving captain in 'your turn'. Keep the racetrack and the ? bubble.
- Crew parachute drop and back-hop choreography. Crew appear working (2-frame busy feet) and stand idle when back; cheer frames only at a party landing.
- Lightning full-scene white flash. Keep the bolt sprite blinking at ≤1 Hz.
- Departure board, board-flip and jet-bridge slide one-shots. Keep a static jet bridge and the captain at the gate.
- Thinking bubble and long-haul hourglass in the Svg. They stay in the deck card's activity Text.
- Animated gutter mini-plane Svg in list rows. Use a static ✈ Text glyph instead.
- A third Animations value ('still' static pictures). Leave room for it with the anim() helper.
- Contract rewrite and new pin/label schema fields. Pin words are derived by signOf().
- Voicing the remaining ~190 deck keys (editors, decision panel, /flight replies, model fallbacks, gloss/activity strings, config labels). They stay shared plain strings, with v1 jargon fixed (feature/waypoint → stop).
- Footer voice toggle button, '/flight voice' and View.voice. The Words setting in /config is enough.
- Terminal Raster half-block animation and $.ui.blit. The terminal gets a 2-line Text strip (clock row plus a '· ✓ · ✈ · o · ⚑' route line).
- prefers-color-scheme <style> inside the Svg. The self-framed banner with keylines is enough.
- Proportional pin spacing and Engine's 192×48 geometry.
- Engine's optional 'finer clock' (0.5 × observed writes of the active step).
- Hover polish spike S10 and Art's dot-leader width math (use space-between rows).
- Engine's render-history memo with sticky one-shots, and the module Map keyed by surface:requestId.

### phasing

PHASE 0: v1 ON GITHUB (the user's first ask; do it now). In plain words: save v1 and put it on GitHub with a version tag.
- First, the lead asks the user: public or private (default private), who holds the LICENSE, and whether docs/spike-results.md can be published as-is.
- Edits: .claude-plugin/plugin.json version 0.1.0→1.0.0. .claude-plugin/marketplace.json name 'flightplan-local'→'flightplan'. Add LICENSE (MIT). README: Install becomes '/plugin install flightplan --marketplace aravinth01/flightplan' typed in a terminal session; a Developing section uses flightplan@flightplan; delete the 'share it later' paragraph. .gitignore adds node_modules/, *.log, flightplan-spike-log.json, .env*.
- Checks: `claude plugin validate ~/Projects/flightplan` and `claude plugin test ~/Projects/flightplan` (37 pass).
- Push: git init -b main, add, check `git status --short` for no .DS_Store/tsconfig/logs, commit with the Co-Authored-By line. The user runs `gh auth login` (verified not logged in). Then `gh repo create aravinth01/flightplan --private|--public --source ~/Projects/flightplan --remote origin --push`, tag v1.0.0, `gh release create v1.0.0`.
- Re-point this Mac's install to flightplan@flightplan, then `git switch -c v2-pixel-skies`.
- SHIPS: v1.0.0.

PHASE 1: LAB SPIKES (branch v2-lab, never merged). In plain words: 30-minute experiments in the real app before building anything big.
- Add '/flight lab', which opens a lab pane drawing these tests:
  - S1: sizing (markup width vs viewBox-only vs width=100% vs explicit px), plus row footprint and scroll with an editor open.
  - S2: a byte-identical source keeps SMIL running through Text redraws, alt changes and sibling toggles.
  - S3: crispEdges at non-integer scale, in the light and dark themes.
  - S4: clipPath, pattern and <title> survive the scrub.
  - S5: discrete visibility; animateMotion with keyPoints and keySplines on an inline path; negative begin; fill=freeze; additive=sum.
  - S7: the signs row lines up for N=3/5/8.
  - S8: inverse chips, and ✅ ✈️ 🎟 on desktop.
  - S9: CPU during a busy flight and on an idle pane over 10 minutes.
- Write the decisions into docs/spike-results.md §6: SIZING mode, cloud-phase strategy, signs row on/off, chip style, idle loops.
- KILL SWITCH: if S2 fails (every redraw restarts SMIL), the banner becomes a non-interactive static picture per state and Phase 5 shrinks to the landing card only; Phases 2-4 hold.
- SHIPS: decisions only; v1 untouched.

PHASE 2: HONEST FUN WORDS (v1.1.0). In plain words: the map talks light gen-z (or plain), and only celebrates what was really tested.
- hooks/text.ts: WORDS {fun, plain} for ~60 user-facing keys; say(); NOUN_STOP='stop'; emoji budget; terminal swaps; clockOf() and the clock phrase table.
- hooks/model.ts: hasReceipts, landingOf, step.checkedAt (set only on seen passes).
- hooks/register.tsx: config.voice; honest landing (party fanfare / quiet chime / amber silent, with matching toasts); celebrateUntil no longer set on landing; helpers gain startedAt/doneAt/isError.
- hooks/pane.tsx: one chipKindOf honesty mapping; the clock Text row (desktop and terminal); deck card with '● ● ● TAG', captain chip, one bold accent word; 'Add a stop'.
- plugin.json: 'voice' field (title Words); 'fun' retitled Animations.
- types/index.d.ts: the new optional fields.
- Tests: words.test.ts (pairs complete, no empties, emoji allow-list, 'receipts' only on seen checks, length limits); landing matrix in model.test.ts; flight.test.tsx with { voice: 'plain' }, plus one fun-voice flight with no 'we ate' on a quiet landing.
- SHIPS: v1.1.0.

PHASE 3: THE PIXEL SKY, LOOPS ONLY (v2.0.0-rc1). In plain words: an 8-bit sky with drifting clouds, the sun moving as steps get done, pins for each stop, the plane on the right spot, Claude as the captain and helpers as crew.
- New flat files:
  - hooks/pixels.ts: toPaths with run merge, esc, integer formatting.
  - hooks/art.ts: Art's grids and palettes; replaces sprites.ts and keeps GLYPHS/Pose for the terminal and band.
  - hooks/scene.ts: geometry (R3), sceneKey without one-shots yet, sceneSvg, sceneAlt, LRU memo, signOf.
- States drawn: sky bands by bucket, sun arc, 2 cloud layers, ground/towers/runways, contrail and route dots, pins (pending/current beacon/done/checked sparkle/failed/yours), plane (3-frame prop, bob), cockpit captain and ground captain (mug at empty, jet bridge at gate, clipboard on a quiet landing), up to 3 crew, ask racetrack + ?, holding per S9, paused overlay with II sprite, chop wobble, storm, and the three static landing variants.
- pane.tsx: keyed 'sky' Box as first child (clock row, Svg, signs row); strip on inline; none on terminal/calm (2-line Text strip there); ✈ glyph in the list; no card plane.
- Tests: scene.test.ts (determinism, ≤32 KB matrix, safety regex, balanced tags, escaping, geometry incl. backward moves, alt ≤200). Pane tests: ≤1 Svg, none under a Button, none on terminal/calm, all states valid at 30/58/100 cols + inline in both voices, and a byte-identical source across activity/details/countdown redraws.
- SHIPS: dogfoodable rc on the branch.

PHASE 4: BOARDING PASSES (v2.0.0-rc2). In plain words: each stop becomes a boarding-pass card; the ones you're not on fold into one-line ticket stubs.
- pane.tsx featureRows → expanded pass: round border in passColor, header 'BOARDING PASS · stop 2 of 4', 'FROM x ✈ TO y · step 2 of 3' + chip, title Button, perforation row, step rows with the chip as a SIBLING Text (never in the Button), crew rows.
- Collapsed stubs use space-between, not dot leaders; landing row.
- Decisions, editors and badges keep v1 keys (sb-, ed-, fb-, db-) and logic.
- The 2.5 s inverse 'receipts ✅' chip comes from step.checkedAt.
- Tests: every existing key still presses; Text hover only inside keyed Boxes; widths 30/58/100.
- SHIPS: rc2.

PHASE 5: THE BIG MOMENTS + RELEASE (v2.0.0). In plain words: the plane glides between steps, takes off, U-turns to fix things; tested steps get a stamp; storms roll in on failing tests; a real all-tested landing gets confetti and a cheering crew.
- model.ts: route.planeFrom (set in moveTo, seeWrite, and reconcile before nulling plane), route.takeoffAt. All new fields optional, so v1 routes restored from $.store default to 0/null.
- scene.ts one-shots (R4):
  - glide/U-turn 1.4 s; takeoff 2.6 s; sky and sun tween on a bucket change
  - receipts badge on the pin, 2.5 s; your-turn pop; storm slide-in
  - landing: party 6 s (descend, bounce, roll, 24 confetti, captain + crew cheer), quiet/amber 3 s with no confetti
- register.tsx: $.clock.after(window+50) invalidate at each event site. Sounds: tick = stamp, chime = a stop fully tested or a quiet landing, knock = your turn, fanfare = party only.
- Live flights in the desktop app: light and dark themes, narrow and wide, 1/4/8 stops with 12 steps, a failing-tests flight (storm, amber landing), a redo (U-turn), a helper flight, plus a CPU check.
- Release: README (screenshots; Settings table with Words and Animations), docs/spec.html, plugin.json 2.0.0, PR v2-pixel-skies→main, tag v2.0.0, gh release.
- SHIPS: v2.0.0.

CRITICAL FILES:
- hooks/pane.tsx
- hooks/register.tsx
- hooks/model.ts
- hooks/text.ts
- new hooks/scene.ts (with pixels.ts and art.ts)
- types/index.d.ts
- tests/flight.test.tsx
