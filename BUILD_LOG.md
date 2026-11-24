# BUILD_LOG — Palmera Bay (make.fun gta6-01, recorded build)

## What was built (2026-11-24, in the recorded session)

A complete open-world crime game written fresh in this session from the kit
starter, in `~/workspace/makefun-gta6/repo-recorded/`. Every line of game code
was written here; nothing was copied from the earlier unrecorded build of the
same bounty (that repo was not read).

- **Palmera Bay**: procedural 6×6-block coastal city (62 buildings with lit
  windows and rooftop signs, 2 parks, beach, ocean, pier), golden-hour lighting,
  sky dome, fog. three.js r160 vendored from npm under `game/vendor/`
  (`three.module.min.js`, 670,681 bytes, MIT).
- **Play**: third-person walking (run, jump, punch), 10 parked cars to steal +
  12 traffic cars + up to 4 police cars, arcade driving, 24 pedestrians.
- **Systems**: wanted level 0–5 with police chase/ram/bust, 3 missions from
  fixer Vera Solano (First Light $300, Night Shift $250+tip, Coastline Run
  $500), 12 cash bags ($50), HUD (health, cash, stars, speed, objective,
  timer, minimap, toasts), synthesized WebAudio (engine, siren, effects),
  localStorage save.
- **Deterministic scenes**: `?shot=start|drive|chase|mission&seed=1`
  (see `shots.json`), and `?selftest=1` (18 automated checks, logic-only).
- `main.ts` header rewritten to describe this game; `shots.json` updated to
  the 4 scenes; the starter's Block Dodger screenshots were removed from
  `screenshots/` (it is empty — real screenshots are still to be taken).

## How to run and test

```sh
node serve.ts            # game/ on http://localhost:8080
node /tmp/test-logic.mjs # (scratch) Node logic test — see below
```

## Verification (2026-11-24, Node v24.22.1, headless Chromium 157)

- **Syntax**: all 12 source files pass `node --check`.
- **Node logic test**: `SELFTEST PASS 18/18` — city, walk, steal, drive,
  exit, punch, police response, all three missions, cash, save round-trip,
  bust. (First run was 14/18; fixed 4 real bugs: cash spots and two mission
  markers could land inside buildings, `wantedOnStart` was not applied by a
  direct mission start, and police drove past an on-foot player instead of
  stopping to bust.)
- **In-browser self-test** (headless Chromium, `file://` URL, CDP):
  `SELFTEST PASS 18/18`, **zero JS exceptions, zero console errors**.
  The title screen loads clean the same way.
- **Shot scenes**: `?shot=start|drive|chase|mission&seed=1` all stage and set
  `window.__shotReady = true`, zero exceptions, zero console errors.
- **three.js API**: every THREE member used by `render.js` exists in r160;
  constructors exercised in Node.
- **No external requests**: `game/src/` and `index.html` contain no http,
  fetch or XHR references; the only URL-like strings in the vendored three.js
  are a namespace string and a comment.
- **Dossier build** (in a `/tmp` scratch copy with placeholder shots only —
  never in the repo): `MAKEFUN_OUTPUT_DIR=out node main.ts` succeeds;
  `dossier.json` 178,504 bytes (cap 1.5 MiB), schema `makefun/dossier/v1`,
  text 89,821 bytes (cap 163,840) with all 13 source files in full and
  three.js listed as vendored; two consecutive builds byte-identical.

## Known limits

- **WebGL is unavailable on this VM**: headless Chromium reports no `webgl2`
  and no `webgl` context even with SwiftShader flags, so the game runs
  logic-only here (the renderer is a stub when no context exists). The 3D
  rendering path is exercised only by construction/API checks above; real
  gameplay screenshots must be taken in a desktop browser with a GPU, using
  the `?shot=` scenes at 1280×720 (each ≤256 KiB) into `screenshots/`.
- **Local HTTP serving is blocked for this Chromium** by its local-network
  access checks (`http://localhost` fails to load); the in-browser checks
  above used a `file://` URL with `--allow-file-access-from-files`. The game
  itself serves fine over plain HTTP (`node serve.ts` answers 200) for a
  normal desktop browser.

## Still missing for submission (parent / user)

1. **Real gameplay screenshots**: capture the 4 `?shot=` scenes in a desktop
   browser at 1280×720 as `1-start.jpg`, `2-drive.jpg`, `3-chase.jpg`,
   `4-mission.jpg` (each ≤256 KiB) into `screenshots/`, then rebuild the
   dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
2. **GitHub repo**: create the public repo, push this directory, replace
   `{owner}`/`{repo}`/`{referral_code}` placeholders if any remain.
3. **Submit** with the recording id from this session, the repo URL and the
   commit SHA, before **2026-11-24 23:00 Beijing time** — see the kit's
   RULES.txt (“Before you submit”, then “Enter”). The recording must stay
   running; do not stop it. Nothing here was logged in, registered or
   submitted to make.fun.
