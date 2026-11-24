// The automated self-test behind ?selftest=1&seed=N. It runs the real simulation headlessly
// — no WebGL, no renderer — and checks the game's rules end to end: the city, walking,
// stealing and driving a car, the wanted level and the police, all four missions, cash
// pickups, the bust, and the save. Results go to window.__selftest and to #selftest in the
// page, so a headless browser can read them.

import { CASH, STEP } from './config.js';
import { EVENT_ENTER } from './world.js';

function input(over) {
  return {
    moveX: 0, moveY: 0, run: false, jump: false, punch: false,
    enter: false, handbrake: false, camYaw: 0, ...over,
  };
}

function stepFor(world, seconds, inp) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, inp || input());
}

export function runSelfTest(world, city) {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name, ok: !!ok, detail: detail || '' });
  }
  const s = world.state;

  world.reset();
  check('city: buildings and colliders', city.buildings.length >= 40 && city.colliders.length === city.buildings.length, `${city.buildings.length} buildings`);
  check('city: 10 parked cars, 18 cash spots', city.parked.length === 10 && city.cashSpots.length === CASH.count, `${city.parked.length} parked, ${city.cashSpots.length} cash spots`);
  check('city: 4 boats moored off the marina', city.boats.length === 4 && city.boats.every((b) => b.x > 188), `${city.boats.length} boats`);
  check('world: 26 cars and 24 pedestrians', s.cars.length === 26 && s.peds.length === 24, `${s.cars.length} cars, ${s.peds.length} peds`);

  // Walking.
  const x0 = s.player.x;
  const z0 = s.player.z;
  stepFor(world, 2, input({ moveY: 1, camYaw: s.player.heading + Math.PI }));
  const walked = Math.hypot(s.player.x - x0, s.player.z - z0);
  check('walk: player moves on foot', walked > 6, `${walked.toFixed(1)} m in 2 s`);

  // Steal the first parked car and drive it.
  const car0 = s.cars[0];
  s.player.x = car0.x + 2.5;
  s.player.z = car0.z;
  const enterEvents = world.step(STEP, input({ enter: true }));
  check('steal: enter a parked car', !s.player.onFoot && s.player.carId === 0 && (enterEvents & EVENT_ENTER) !== 0, `carId ${s.player.carId}`);
  check('steal: wanted rises to 1', s.wanted >= 1, `${s.wanted} star(s)`);
  const cx0 = car0.x;
  const cz0 = car0.z;
  stepFor(world, 3, input({ moveY: 1 }));
  const driven = Math.hypot(car0.x - cx0, car0.z - cz0);
  check('drive: car moves under power', driven > 10, `${driven.toFixed(1)} m in 3 s`);
  world.step(STEP, input({ enter: true }));
  check('exit: player gets out', s.player.onFoot && s.player.carId === -1, 'on foot again');

  // Punch a pedestrian: wanted rises.
  const ped = s.peds[0];
  ped.mode = 'walk';
  s.player.x = ped.x - Math.sin(s.player.heading) * 1.2;
  s.player.z = ped.z - Math.cos(s.player.heading) * 1.2;
  const wantedBefore = s.wanted;
  world.step(STEP, input({ punch: true }));
  check('punch: hitting a pedestrian raises wanted', s.wanted > wantedBefore && ped.mode === 'down', `wanted ${wantedBefore} -> ${s.wanted}`);

  // Police respond to a 3-star wanted level.
  world.addWanted(3);
  stepFor(world, 0.5);
  let police = s.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  const d0 = police.length ? Math.min(...police.map((c) => Math.hypot(c.x - s.player.x, c.z - s.player.z))) : Infinity;
  stepFor(world, 2.5);
  police = s.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  const d1 = police.length ? Math.min(...police.map((c) => Math.hypot(c.x - s.player.x, c.z - s.player.z))) : Infinity;
  check('police: 3 stars brings at least 2 cars', police.length >= 2, `${police.length} police cars`);
  check('police: they close in on the player', d1 < d0, `${d0.toFixed(0)} m -> ${d1.toFixed(0)} m`);

  // Mission 1: pick up and deliver.
  world.reset();
  const started = world.missions.start(0);
  check('mission 1: starts from the plaza job', started && world.missions.active === 0, 'First Light active');
  s.player.x = city.spots.pickup.x;
  s.player.z = city.spots.pickup.z;
  world.step(STEP, input());
  check('mission 1: reaching the pickup advances the job', world.missions.step === 1, `step ${world.missions.step}`);
  s.player.x = city.spots.dropoff.x;
  s.player.z = city.spots.dropoff.z;
  const cashBefore = s.cash;
  world.step(STEP, input());
  check('mission 1: delivery pays $300', world.missions.done[0] && s.cash === cashBefore + 300, `cash $${cashBefore} -> $${s.cash}`);

  // Mission 3 arms a 2-star wanted level on start.
  world.reset();
  world.startMission(2);
  check('mission 3: Coastline Run starts with 2 stars', s.wanted === 2, `${s.wanted} star(s)`);

  // Mission 4: three crates, then the pier — and it pays $600 with 1 star on start.
  world.reset();
  const started4 = world.startMission(3);
  check('mission 4: Harbor Lights starts with 1 star', started4 && world.missions.active === 3 && s.wanted === 1, `active ${world.missions.active}, ${s.wanted} star(s)`);
  const cashBefore4 = s.cash;
  const crateSpots = [city.spots.stash0, city.spots.stash1, city.spots.stash2, city.spots.hideout];
  for (let i = 0; i < crateSpots.length; i += 1) {
    s.player.x = crateSpots[i].x;
    s.player.z = crateSpots[i].z;
    world.step(STEP, input());
  }
  check('mission 4: all three crates and the delivery pay $600', world.missions.done[3] && s.cash === cashBefore4 + 600, `cash $${cashBefore4} -> $${s.cash}`);

  // Cash bag.
  world.reset();
  const bag = s.cashBags[0];
  const bagCash = s.cash;
  s.player.x = bag.x;
  s.player.z = bag.z;
  world.step(STEP, input());
  check('cash: a bag pays $50', bag.taken && s.cash === bagCash + 50, `cash $${bagCash} -> $${s.cash}`);

  // Save and load round-trip.
  const save = world.getSave();
  const savedCash = s.cash;
  world.reset();
  world.applySave(save);
  check('save: cash and progress survive a reload', s.cash === savedCash && s.cashBags[0].taken, `cash $${s.cash}`);

  // Bust: a police car on a slow player on foot.
  world.reset();
  world.addWanted(1);
  stepFor(world, 0.5);
  const cop = s.cars.find((c) => c.kind === 'police' && !c.wrecked);
  if (cop) {
    cop.x = s.player.x + 1;
    cop.z = s.player.z + 1;
    cop.speed = 0;
  }
  stepFor(world, 3);
  check('bust: standing still next to police gets you busted', s.busted, s.busted ? 'busted' : 'not busted');

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  const result = { passed, failed, total: checks.length, checks };
  if (typeof window !== 'undefined') {
    window.__selftest = result;
    const el = document.getElementById('selftest');
    if (el) {
      el.textContent = `SELFTEST ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${checks.length}\n` + checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name} — ${c.detail}`).join('\n');
    }
  }
  return result;
}
