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
import { createRenderer } from './render.js';
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
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
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
