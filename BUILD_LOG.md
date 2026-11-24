# BUILD_LOG — Palmera Bay v2 (make.fun gta6-01, recorded build)

## What was built (2026-11-24, in the recorded session)

A complete open-world crime game written in the recorded sessions, in
`~/workspace/makefun-gta6/repo-recorded-v2/`. v2 is a strengthened iteration of
the v1 entry (which was already submitted and accepted as 01a20c89): the same
game, with the staging drift fixed, a fourth mission, a busier world, a clearer
HUD, and new screenshots shot on this machine.

- **Palmera Bay v2**: procedural 6×6-block coastal city (65 buildings with lit
  windows and rooftop signs, 2 parks, beach, ocean, pier, a marina with 4
  moored boats bobbing on the water), golden-hour lighting, sky dome, fog.
  three.js r160 vendored from npm under `game/vendor/`
  (`three.module.min.js`, 670,681 bytes, MIT).
- **Play**: third-person walking (run, jump, punch), 10 parked cars (now
  parallel-parked along the curb, so they pull out down the street instead of
  nose-first into a building) to steal + 16 traffic cars in ten colours + up to
  4 police cars, arcade driving, 24 pedestrians.
- **Systems**: wanted level 0–5 with police chase/ram/bust, 4 missions from
  fixer Vera Solano (First Light $300, Night Shift $250+tip, Coastline Run
  $500, Harbor Lights $600 — three crates, then the pier, with the harbour horn
  sounding as the job starts), 18 cash bags ($50), HUD (health, cash, a
  labelled wanted meter, speed, a job-and-step objective tracker, timer,
  minimap, toasts), synthesized WebAudio (engine, siren, effects, horn,
  fanfare; M mutes), localStorage save.
- **Deterministic scenes**: `?shot=start|drive|chase|mission&seed=1`
  (see `shots.json`), and `?selftest=1` (21 automated checks, logic-only).
  The chase scene stages exactly 3 wanted stars (v1 showed 4: stealing the
  car already adds 1 star, so `addWanted(3)` made 4 — now the level is set
  exactly and re-asserted after the drive). The drive, chase and mission scenes
  start on the beach road, the one stretch with no buildings, so the car drives
  instead of wedging into a wall; the chase cruises at 12 m/s for its last
  3 s so the police close in, and its camera sits rear-side so the closing
  police are in the frame.

## How to run and test

```sh
node serve.ts            # game/ on http://localhost:8080
node /tmp/v2-selftest.mjs # (scratch) Node logic test — see below
```

## Verification (2026-11-24, Node v24.22.1, headless Chromium 157 with WebGL2)

- **Syntax**: all 12 source files pass `node --check`.
- **Node logic test**: `SELFTEST PASS 21/21` — city, walk, steal, drive (66.2 m
  in 3 s, up from 7.6 m in the first v2 run — the parallel-parking fix),
  exit, punch, police response, all four missions (Harbor Lights pays $600),
  cash, save round-trip, bust. The chase staging check reads wanted = 3 with
  3 police cars.
- **In-browser self-test** (headless Chromium, `file://` URL, CDP):
  `SELFTEST PASS 21/21`, **zero JS exceptions, zero console errors**.
  The title screen loads clean the same way.
- **Shot scenes**: `?shot=start|drive|chase|mission&seed=1` all stage and set
  `window.__shotReady = true`, zero exceptions. All four were captured on this
  machine with the CDP driver (`tools/palmera-shot.mjs`, WebGL2 via SwiftShader
  and the `hatch-webgl-all-origins-v1` policy) at 1280×720, each under the
  256 KiB cap, and visually verified as real gameplay: title card over the
  city (v2 copy: four jobs, 18 bags, M to mute), a 122 km/h beach drive with
  the ocean on the left, a 3-star chase at 43 km/h with police on the minimap,
  a 122 km/h mission run toward the docks with the objective tracker reading
  "First Light · Pick up the package at the docks".
- **three.js API**: every THREE member used by `render.js` exists in r160;
  constructors exercised in Node.
- **No external requests**: `game/src/` and `index.html` contain no http,
  fetch or XHR references; the only URL-like strings in the vendored three.js
  are a namespace string and a comment.
- **Dossier build**: `MAKEFUN_OUTPUT_DIR=out node main.ts` succeeds;
  `dossier.json` 435,265 bytes (cap 1,572,864), schema `makefun/dossier/v1`,
  with all 13 source files in full and three.js listed as vendored.

## What changed from v1 (for the record)

- Chase HUD drift fixed (4 stars → exactly 3, matching `shots.json`).
- Fourth mission: Harbor Lights ($600, three crates + pier delivery, 1 star
  on start, harbour horn, crate stinger, payout fanfare).
- Cash bags 12 → 18 (12 street, 3 beach, 2 pier, 1 park); traffic 12 → 16
  cars in ten colours; 4 moored boats in the marina; parked cars
  parallel-parked.
- HUD: a "WANTED · N stars" label, and the objective names the job and the
  step. Title card updated (four jobs, 18 bags, M to mute). M mutes the audio.
- Self-test 18 → 21 checks (boats, Harbor Lights start and payout).

## Still missing for submission (parent)

1. **Push** this directory to the public repo (the v1 repo
   `ltao168169/palmera-bay` is already there; the new commit replaces the
   v1 commit as the entry).
2. **Submit** with the new recording id from this session, the repo URL and
   the new commit SHA, before **2026-11-24 23:00 Beijing time**. The recording
   must stay running; do not stop it. The v1 submission (01a20c89) stays valid
   as a fallback if this version is not submitted in time.
