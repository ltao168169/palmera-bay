[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ltao168169/palmera-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ltao168169/palmera-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PALMERA BAY v2 — an open-world crime game

A sun-soaked open-world crime game for the [make.fun **“Make GTA 6”** bounty](https://make.fun/bounty/gta6-01)
($1,666 USDC, 100 paid places). You are **Danny Cole**, fresh out and broke in
Palmera Bay. Fixer **Vera Solano** has work for you — if you can stay ahead of
the Palmera Bay PD.

## The game

- **A procedural coastal city**: a 6×6 street grid of ~62 buildings with lit
  windows and rooftop signs, parks, streetlights and palms, a beach, the ocean
  and a wooden pier, plus a marina with four moored boats bobbing on the water.
  Golden-hour sun, sky dome and fog. Fully offline.
- **On foot**: run, jump, punch. **By car**: steal parked cars or pull drivers
  out of traffic, arcade driving with handbrake, 16 traffic cars in ten colours
  and 24 pedestrians sharing the roads.
- **Wanted level 0–5 stars**: crimes raise it; police cars chase, ram and bust
  you if you stand still next to them on foot. It fades when you lay low.
- **Missions from Vera Solano**: *First Light* (pick up a package at the docks,
  deliver it to Club Nova, $300), *Night Shift* (ferry a hotel guest to the
  marina against the clock, $250 + tip), *Coastline Run* (six checkpoints down
  the beach road with the cops already watching, $500), and *Harbor Lights*
  (collect three crates — beach, old town, marina road — and deliver them to the
  end of the pier, $600, with the harbour horn sounding as the job starts).
  Plus 18 cash bags ($50 each) hidden around the city.
- **HUD**: health, cash, a labelled wanted meter, speedometer, objective tracker
  that names the job and the step, timer, a live minimap, toasts. **Sound**:
  synthesized WebAudio — engine hum, two-tone siren, pickup and mission
  stingers, a harbour horn and a payout fanfare; **M** mutes. **Save**: cash,
  jobs and bags persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Run |
| Space | Jump / handbrake (in car) |
| E | Enter a car / take Vera’s job at the plaza |
| F | Punch |
| Mouse drag / wheel | Orbit camera / zoom |
| P / Esc | Pause |
| M | Mute / unmute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

`?seed=N` fixes the city. `?shot=start|drive|chase|mission&seed=1` stages a
deterministic screenshot scene (see `shots.json`). `?selftest=1&seed=1` runs the
automated checks in-page and writes `window.__selftest` (21 checks, all logic,
no WebGL needed). The chase scene stages exactly 3 wanted stars (see
`shots.json`: `wantedLevel` 3).

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output and writes
`dossier.json`. Put 3–4 real JPEG screenshots of the game (1280×720, each
≤256 KiB) in `screenshots/` first — the first by name is the cover.

## Files

- `game/index.html` — canvas, HUD and screens, import map for three.js
- `game/src/config.js` — every tuning number and colour
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/input.js` — keyboard and mouse
- `game/src/city.js` — procedural city, collisions, spawn points
- `game/src/missions.js` — the four jobs and their state machine
- `game/src/world.js` — the simulation: player, cars, traffic, peds, police
- `game/src/render.js` — the three.js scene and camera
- `game/src/audio.js` — synthesized WebAudio
- `game/src/hud.js` — HUD, minimap and screens
- `game/src/shots.js` — staged screenshot scenes
- `game/src/selftest.js` — the automated checks
- `game/src/main.js` — boot and the game loop
- `game/vendor/three.module.min.js` — three.js r160 (MIT), vendored from npm
- `main.ts`, `serve.ts`, `shots.json`, `vendor/makefun-game.ts` — kit plumbing
