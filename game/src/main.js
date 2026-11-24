// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between four screens: title,
// play, paused and end (busted or wasted). ?seed=N fixes the city; ?shot=start|drive|chase|
// mission stages that scene instead of running the loop and sets window.__shotReady;
// ?selftest=1 runs the automated checks headlessly and writes window.__selftest.

import { SAVE_KEY, STEP } from './config.js';
import { buildCity } from './city.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_COIN, EVENT_CRIME, EVENT_ENTER, EVENT_EXIT, EVENT_HIT, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_MISSION_STEP, EVENT_PUNCH, EVENT_WASTED, EVENT_WRECK } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer } from './render.js?v=5';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = buildCity(createRandom(seed));
const world = createWorld(createRandom(seed + 7), city);
const renderer = createRenderer(canvas, city);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud(document, city);

let camYaw = world.state.player.heading + Math.PI;
let camPitch = 0.38;
let camDist = 10;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave() {
  const save = readSave();
  if (save) {
    world.applySave(save);
    return save;
  }
  return null;
}

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const staged = stageShot(name, world);
  camYaw = staged.camYaw;
  camPitch = staged.camPitch;
  camDist = staged.camDist;
  if (renderer.hasWebGL) renderer.setCameraPose(camYaw, camPitch, camDist);
  hud.setTitleBest(world.state.bestCash, world.missions.done.filter(Boolean).length);
  hud.update(world.state, world.missions, 0);
  if (staged.screen === 'title') hud.showScreen('title');
  else hud.showScreen(null);
  let painted = 0;
  function paint() {
    if (renderer.hasWebGL) renderer.render(world.state, 0, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      // Capture the frame synchronously right after this render, while the
      // drawing buffer still holds it. Reading it later (e.g. on a button
      // click seconds afterwards) returns a cleared/black buffer.
      window.__shotReady = true;
      captureShotFrame(name);
      setupShotDownload(name);
    }
  }
  requestAnimationFrame(paint);
}

// Capture the current game frame to a 1280x720 JPEG under the 256 KiB cap, and
// keep the data URL so the download button can save it later. Must run in the
// same task as the render (see runShot): the WebGL buffer is only readable
// until the browser composites the frame.
const SHOT_FILES = { start: '1-start.jpg', drive: '2-drive.jpg', chase: '3-chase.jpg', mission: '4-mission.jpg' };
let shotCapture = null;
function captureShotFrame(name) {
  const file = SHOT_FILES[name] || `${name}.jpg`;
  const src = canvas;
  const out = document.createElement('canvas');
  out.width = 1280;
  out.height = 720;
  const ctx = out.getContext('2d');
  // Cover-crop the frame to 16:9 without distortion.
  const sRatio = src.width / src.height;
  const tRatio = 1280 / 720;
  let sw = src.width;
  let sh = src.height;
  let sx = 0;
  let sy = 0;
  if (sRatio > tRatio) { sw = src.height * tRatio; sx = (src.width - sw) / 2; }
  else { sh = src.width / tRatio; sy = (src.height - sh) / 2; }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 1280, 720);
  for (const q of [0.85, 0.7, 0.55, 0.4, 0.3]) {
    const url = out.toDataURL('image/jpeg', q);
    const bytes = Math.round((url.length - 'data:image/jpeg;base64,'.length) * 0.75);
    if (bytes <= 262144 || q === 0.3) { shotCapture = { url, bytes, q, file }; break; }
  }
  window.__shotCapture = shotCapture;
}

// When a staged scene (?shot=) is ready, offer a one-click download of the frame as a
// 1280x720 JPEG under the 256 KiB cap, so the shot can be saved from a browser that
// cannot otherwise export the WebGL canvas. The button is the user gesture the download
// needs; the file name matches shots.json. The image data was captured synchronously
// right after the render (captureShotFrame); the button only saves that stored data.
function setupShotDownload(name) {
  const file = SHOT_FILES[name] || `${name}.jpg`;
  const btn = document.createElement('button');
  btn.id = 'shot-download';
  btn.textContent = `Download ${file} (1280x720 JPEG)`;
  btn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;padding:10px 14px;font:14px sans-serif;background:#0f766e;color:#fff;border:0;border-radius:8px;cursor:pointer;';
  btn.addEventListener('click', () => {
    const cap = shotCapture || window.__shotCapture;
    if (!cap) { btn.textContent = 'Capture not ready — reload the scene'; return; }
    const a = document.createElement('a');
    a.href = cap.url;
    a.download = cap.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    btn.textContent = `Saved ${cap.file} (${cap.bytes} bytes, q${cap.q})`;
  });
  document.body.appendChild(btn);
}

function runGame() {
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  const save = applySave();
  hud.setTitleBest(world.state.bestCash, world.missions.done.filter(Boolean).length);
  hud.showScreen('title');
  announce('Palmera Bay. Press Enter or click to start.');

  function startGame() {
    screen = 'play';
    hud.showScreen(null);
    audio.unlock();
    announce('Playing. Vera has work at the plaza — follow the yellow marker.');
    hud.toast('Vera Solano: Danny, you’re out. I’ve got work — meet me at the plaza.');
  }

  function endGame(busted) {
    screen = 'end';
    world.state.cash = Math.floor(world.state.cash * 0.9);
    world.state.wanted = 0;
    world.missions.cancel();
    saveGame();
    if (busted) {
      audio.bust();
      hud.showEnd('BUSTED', 'The Palmera Bay PD caught up with you. Bail took 10% of your cash — the plaza is where you start over.');
      announce('Busted. Press Enter to get back out there.');
    } else {
      audio.bust();
      hud.showEnd('WASTED', 'Palmera Bay is unforgiving. The hospital took 10% of your cash — the plaza is where you start over.');
      announce('Wasted. Press Enter to get back out there.');
    }
  }

  function respawn() {
    const p = world.state.player;
    p.x = city.spots.plaza.x + 6;
    p.z = city.spots.plaza.z + 6;
    p.y = 0;
    p.vy = 0;
    p.vx = 0;
    p.vz = 0;
    p.health = 100;
    p.onFoot = true;
    p.carId = -1;
    world.state.busted = false;
    world.state.wasted = false;
    camYaw = p.heading + Math.PI;
    screen = 'play';
    hud.showScreen(null);
    announce('Playing.');
  }

  function react(events) {
    if (events & EVENT_COIN) {
      audio.cash();
      hud.toast(`+$50 cash — $${world.state.cash.toLocaleString('en-US')} in hand`);
      saveGame();
    }
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_ENTER) audio.enter();
    if (events & EVENT_EXIT) audio.enter();
    if (events & EVENT_CRIME) announce('The police noticed that.');
    if (events & EVENT_MISSION_STEP) {
      audio.mission();
      hud.toast(`Next: ${world.missions.objective()}`);
    }
    if (events & EVENT_MISSION_DONE) {
      audio.mission();
      hud.toast(`Job done — Vera paid $${world.state.lastPayout}`);
      saveGame();
    }
    if (events & EVENT_MISSION_FAIL) {
      audio.fail();
      hud.toast('Job failed — the moment passed.');
    }
    if (events & EVENT_WRECK) {
      audio.fail();
      hud.toast('That ride is wrecked.');
    }
    if (events & EVENT_HIT) announce('You took a hit.');
    if (events & EVENT_BUSTED) endGame(true);
    else if (events & EVENT_WASTED) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const orbit = input.takeOrbit();
    camYaw -= orbit.dx * 0.005;
    camPitch = Math.max(0.12, Math.min(1.1, camPitch + orbit.dy * 0.004));
    camDist = Math.max(6, Math.min(18, camDist * Math.exp(orbit.wheel * 0.001)));
    if (renderer.hasWebGL) renderer.setCameraPose(camYaw, camPitch, camDist);

    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === 'title') startGame();
      else if (screen === 'end') respawn();
      else if (screen === 'paused') {
        screen = 'play';
        hud.showScreen(null);
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        hud.showScreen('pause');
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        hud.showScreen(null);
        announce('Playing.');
      }
    }
    if (screen === 'title' || screen === 'play') {
      const move = input.move();
      const base = {
        moveX: move.x, moveY: move.y, run: input.runHeld(), handbrake: input.handbrakeHeld(),
        jump: false, punch: false, enter: false, camYaw,
      };
      let stepActions = actions;
      accumulator += dt;
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        const stepInput = screen === 'title'
          ? { ...base, moveX: 0, moveY: 0 }
          : {
            ...base,
            jump: (stepActions & ACTION_JUMP) !== 0,
            punch: (stepActions & ACTION_PUNCH) !== 0,
            enter: (stepActions & ACTION_ENTER) !== 0,
          };
        stepActions = 0;
        const events = world.step(STEP, stepInput);
        accumulator -= STEP;
        if (screen === 'play') react(events);
        if (world.state.busted || world.state.wasted) break;
      }
    } else {
      accumulator = 0;
    }

    // Sound follows the world.
    const p = world.state.player;
    const inCar = !p.onFoot && p.carId >= 0 && world.state.cars[p.carId];
    audio.engine(inCar ? Math.abs(world.state.cars[p.carId].speed) / 34 : 0, !!inCar && screen === 'play');
    const policeActive = world.state.cars.some((c) => c.kind === 'police' && !c.wrecked && !c.despawned);
    audio.siren(policeActive && screen === 'play');
    audio.updateSiren(dt);

    if (renderer.hasWebGL) renderer.render(world.state, dt, world.state.time);
    hud.update(world.state, world.missions, dt);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      hud.showScreen('pause');
      announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (selftest) {
  const result = runSelfTest(world, city);
  const el = document.getElementById('selftest');
  el.classList.remove('hidden');
  document.title = `SELFTEST ${result.failed === 0 ? 'PASS' : 'FAIL'} ${result.passed}/${result.total} — Palmera Bay`;
} else if (shot) {
  runShot(shot);
} else {
  runGame();
}
