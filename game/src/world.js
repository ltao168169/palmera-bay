// The game's rules and state, with no drawing and no browser in it: the player on foot and
// in cars, traffic, pedestrians, the police and the wanted level, missions and cash. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. The renderer and the HUD read state.

import { CAR, CASH, CITY, PARKED, PEDS, PLAYER, POLICE, STEP, TRAFFIC, WANTED } from './config.js';
import { collideCircle } from './city.js';
import { createMissions } from './missions.js';
import { pick, range } from './random.js';

export const EVENT_COIN = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRIME = 4;
export const EVENT_MISSION_STEP = 8;
export const EVENT_MISSION_DONE = 16;
export const EVENT_MISSION_FAIL = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_WRECK = 256;
export const EVENT_HIT = 512;
export const EVENT_ENTER = 1024;
export const EVENT_EXIT = 2048;

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createWorld(rng, city) {
  const missions = createMissions(city.spots);
  const state = {
    time: 0,
    player: {
      x: 0, z: 0, y: 0, vy: 0, vx: 0, vz: 0, heading: 0,
      health: PLAYER.health, onFoot: true, carId: -1, punchTimer: 0, hurtTimer: 0,
    },
    cars: [],
    peds: [],
    cashBags: [],
    wanted: 0,
    wantedQuiet: 0,
    cash: 0,
    bestCash: 0,
    busted: false,
    wasted: false,
    nearFixer: false,
    prompt: '',
    stats: { stolen: 0, punched: 0, missions: 0, bags: 0 },
  };

  function makeCar(kind, x, z, angle, color) {
    return {
      id: state.cars.length, kind, x, z, angle, speed: 0, health: CAR.health,
      color, wrecked: false, driver: kind === 'traffic',
      axis: 'x', dir: 1, ramCd: 0, bustTimer: 0, steer: 0,
    };
  }

  function spawnTrafficCar() {
    const p = city.randomStreetPoint();
    const car = makeCar('traffic', p.x, p.z, p.heading, pick(rng, [0xc23b2e, 0x2e6fc2, 0xe8b73a, 0x3aa655, 0xd8d8d8, 0x222226]));
    car.axis = Math.abs(Math.sin(p.heading)) < 0.5 ? 'x' : 'z';
    car.dir = Math.cos(p.heading) >= 0 ? 1 : -1;
    if (car.axis === 'z') car.dir = Math.sin(p.heading) >= 0 ? 1 : -1;
    car.speed = range(rng, TRAFFIC.speed - TRAFFIC.speedJitter, TRAFFIC.speed + TRAFFIC.speedJitter);
    return car;
  }

  function reset() {
    state.time = 0;
    const p = state.player;
    p.x = city.spots.plaza.x + 6;
    p.z = city.spots.plaza.z + 6;
    p.y = 0; p.vy = 0; p.vx = 0; p.vz = 0; p.heading = Math.PI * 0.75;
    p.health = PLAYER.health; p.onFoot = true; p.carId = -1; p.punchTimer = 0; p.hurtTimer = 0;
    state.cars = [];
    for (const spot of city.parked) {
      const car = makeCar('parked', spot.x, spot.z, spot.angle, spot.color);
      state.cars.push(car);
    }
    for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar());
    state.peds = [];
    for (let i = 0; i < PEDS.count; i += 1) {
      const s = city.randomStreetPoint();
      state.peds.push({
        x: s.x + range(rng, -4, 4), z: s.z + range(rng, -4, 4),
        heading: range(rng, 0, Math.PI * 2), speed: PEDS.walkSpeed,
        tx: s.x, tz: s.z, mode: 'walk', modeTimer: range(rng, 2, 6), downTimer: 0,
        color: pick(rng, [0xc25a7a, 0x5a8fc2, 0xd8a03a, 0x6a9a5a, 0x8a5ac2, 0xc2683a]),
      });
    }
    state.cashBags = city.cashSpots.map((s) => ({ x: s.x, z: s.z, taken: false }));
    state.wanted = 0;
    state.wantedQuiet = 0;
    state.cash = 0;
    state.bestCash = 0;
    state.busted = false;
    state.wasted = false;
    state.nearFixer = false;
    state.prompt = '';
    state.stats = { stolen: 0, punched: 0, missions: 0, bags: 0 };
    missions.cancel();
    // Fresh run keeps the save's cash and progress only when the caller applies it.
  }

  function addWanted(n) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.wantedQuiet = 0;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.hurtTimer > 0) return;
    p.health -= amount;
    p.hurtTimer = 0.6;
    if (p.health <= 0) {
      p.health = 0;
      state.wasted = true;
    }
  }

  function startMission(index) {
    if (!missions.start(index)) return false;
    const job = missions.current();
    if (job.wantedOnStart) addWanted(job.wantedOnStart);
    return true;
  }

  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (car.wrecked) continue;
      const dx = car.x - x;
      const dz = car.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const p = state.player;
    const car = nearestCar(p.x, p.z, 3.4);
    if (!car) return 0;
    if (car.kind === 'police') return 0;
    if (car.kind === 'traffic' && car.driver) {
      car.driver = false;
      // The driver bails and runs.
      state.peds.push({
        x: car.x + 2, z: car.z + 2, heading: range(rng, 0, Math.PI * 2), speed: PEDS.runSpeed,
        tx: car.x + 30, tz: car.z + 30, mode: 'flee', modeTimer: 4, downTimer: 0, color: 0xd8a03a,
      });
      addWanted(1);
    } else if (car.kind === 'parked') {
      addWanted(1);
    }
    car.kind = 'player';
    p.onFoot = false;
    p.carId = car.id;
    state.stats.stolen += 1;
    return EVENT_ENTER | EVENT_CRIME;
  }

  function exitCar() {
    const p = state.player;
    const car = state.cars[p.carId];
    if (!car) return 0;
    const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 2;
    const sz = car.z + Math.sin(car.angle + Math.PI / 2) * 2;
    const fixed = collideCircle(sx, sz, PLAYER.radius, city.colliders);
    p.x = fixed.x;
    p.z = fixed.z;
    p.y = 0; p.vy = 0;
    p.onFoot = true;
    p.carId = -1;
    car.speed = 0;
    return EVENT_EXIT;
  }

  function punch() {
    const p = state.player;
    if (p.punchTimer > 0) return 0;
    p.punchTimer = PLAYER.punchCooldown;
    let events = EVENT_PUNCH;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < PLAYER.punchRange + 0.4 && (dx * fx + dz * fz) > -0.3) {
        ped.mode = 'down';
        ped.downTimer = 3;
        addWanted(1);
        state.stats.punched += 1;
        events |= EVENT_CRIME;
        break;
      }
    }
    // A punch dents a car too.
    const car = nearestCar(p.x + fx * 1.2, p.z + fz * 1.2, 2.2);
    if (car && car.kind !== 'player') {
      car.health -= PLAYER.punchDamage;
      if (car.health <= 0 && !car.wrecked) {
        car.wrecked = true;
        events |= EVENT_WRECK;
      }
    }
    return events;
  }

  function stepPlayerOnFoot(dt, input) {
    const p = state.player;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    // Camera-relative movement.
    const sin = Math.sin(input.camYaw);
    const cos = Math.cos(input.camYaw);
    const mx = input.moveX;
    const my = input.moveY;
    let dx = -sin * my + cos * mx;
    let dz = -cos * my - sin * mx;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.01) {
      dx /= len;
      dz /= len;
      const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.vx += (dx * speed - p.vx) * Math.min(1, PLAYER.accel * dt / speed * 4);
      p.vz += (dz * speed - p.vz) * Math.min(1, PLAYER.accel * dt / speed * 4);
      p.heading = angleLerp(p.heading, Math.atan2(dx, dz), Math.min(1, 12 * dt));
    } else {
      p.vx *= Math.max(0, 1 - 10 * dt);
      p.vz *= Math.max(0, 1 - 10 * dt);
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const hit = collideCircle(p.x, p.z, PLAYER.radius, city.colliders);
    p.x = hit.x;
    p.z = hit.z;
    const clamped = city.clampToWorld(p.x, p.z);
    p.x = clamped.x;
    p.z = clamped.z;
    // Jump and gravity.
    if (input.jump && p.y === 0) p.vy = PLAYER.jumpSpeed;
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= PLAYER.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
    }
  }

  function stepPlayerCar(dt, input) {
    const p = state.player;
    const car = state.cars[p.carId];
    if (!car || car.wrecked) {
      if (car && car.wrecked) {
        p.onFoot = true;
        p.carId = -1;
        return EVENT_WRECK;
      }
      return 0;
    }
    const forward = input.moveY;
    const steer = input.moveX;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * 0.6 * dt;
    }
    if (input.handbrake) car.speed -= car.speed * 3 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    if (Math.abs(car.speed) > 0.2) {
      const steerFactor = Math.min(1, Math.abs(car.speed) / 9);
      car.angle += steer * CAR.steerRate * steerFactor * dt * (car.speed >= 0 ? 1 : -1);
    }
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    const hit = collideCircle(car.x, car.z, CAR.radius, city.colliders);
    if (hit.hit) {
      if (Math.abs(car.speed) > 12) {
        car.health -= 14;
        car.speed *= -0.25;
      } else car.speed *= 0.4;
      car.x = hit.x;
      car.z = hit.z;
    }
    const clamped = city.clampToWorld(car.x, car.z);
    if (clamped.x !== car.x || clamped.z !== car.z) {
      car.speed *= 0.4;
      car.x = clamped.x;
      car.z = clamped.z;
    }
    p.x = car.x;
    p.z = car.z;
    p.heading = car.angle;
    // Running over a pedestrian is a crime.
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      const dx = ped.x - car.x;
      const dz = ped.z - car.z;
      if (dx * dx + dz * dz < 2.4 * 2.4 && Math.abs(car.speed) > 3) {
        ped.mode = 'down';
        ped.downTimer = 3;
        car.speed *= 0.9;
        addWanted(1);
        state.stats.punched += 1;
        return EVENT_CRIME;
      }
    }
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      p.onFoot = true;
      p.carId = -1;
      p.x = car.x + 2;
      p.z = car.z + 2;
      return EVENT_WRECK;
    }
    return 0;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || car.wrecked) continue;
      // Slow down for a car ahead.
      let ahead = Infinity;
      for (const other of state.cars) {
        if (other === car || other.wrecked) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const forward = dx * Math.sin(car.angle) + dz * Math.cos(car.angle);
        const side = Math.abs(dx * Math.cos(car.angle) - dz * Math.sin(car.angle));
        if (forward > 0 && forward < 9 && side < 2.4) ahead = Math.min(ahead, forward);
      }
      const target = ahead < 9 ? 0 : TRAFFIC.speed;
      car.speed += (target - car.speed) * Math.min(1, 2 * dt);
      const stepLen = car.speed * dt;
      let nx = car.x;
      let nz = car.z;
      if (car.axis === 'x') nx += car.dir * stepLen;
      else nz += car.dir * stepLen;
      // At an intersection, maybe turn.
      const cross = car.axis === 'x' ? nz : nx;
      const nearest = city.nearestStreet(cross);
      const along = car.axis === 'x' ? nx : nz;
      if (Math.abs(cross - nearest) < 1 && Math.abs(along - city.nearestStreet(along)) < 2.5) {
        if (rng() < 0.35) {
          car.axis = car.axis === 'x' ? 'z' : 'x';
          car.dir = rng() < 0.5 ? 1 : -1;
          car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (car.axis === 'x') nz = nearest + (rng() < 0.5 ? 3 : -3);
          else nx = nearest + (rng() < 0.5 ? 3 : -3);
        }
      }
      const hit = collideCircle(nx, nz, CAR.radius, city.colliders);
      car.x = hit.x;
      car.z = hit.z;
      const clamped = city.clampToWorld(car.x, car.z);
      car.x = clamped.x;
      car.z = clamped.z;
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.mode === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) { ped.mode = 'flee'; ped.modeTimer = 4; }
        continue;
      }
      if (ped.modeTimer > 0) ped.modeTimer -= dt;
      // Flee from a fast car or a punching player.
      const playerCar = !p.onFoot ? state.cars[p.carId] : null;
      const threatSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      const dxT = ped.x - p.x;
      const dzT = ped.z - p.z;
      const dT = Math.sqrt(dxT * dxT + dzT * dzT);
      if (dT < 5 && threatSpeed > 6) {
        ped.mode = 'flee';
        ped.modeTimer = 2;
        ped.tx = p.x + (dxT / (dT || 1)) * 30;
        ped.tz = p.z + (dzT / (dT || 1)) * 30;
      }
      if (ped.mode === 'flee' && ped.modeTimer <= 0) ped.mode = 'walk';
      const speed = ped.mode === 'flee' ? PEDS.runSpeed : PEDS.walkSpeed;
      const dx = ped.tx - ped.x;
      const dz = ped.tz - ped.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        const s = city.randomStreetPoint();
        ped.tx = s.x + range(rng, -4, 4);
        ped.tz = s.z + range(rng, -4, 4);
        continue;
      }
      ped.heading = angleLerp(ped.heading, Math.atan2(dx, dz), Math.min(1, 6 * dt));
      ped.x += (dx / d) * speed * dt;
      ped.z += (dz / d) * speed * dt;
      const hit = collideCircle(ped.x, ped.z, 0.4, city.colliders);
      ped.x = hit.x;
      ped.z = hit.z;
      const clamped = city.clampToWorld(ped.x, ped.z);
      ped.x = clamped.x;
      ped.z = clamped.z;
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const want = Math.min(state.wanted, WANTED.maxPolice);
    let have = 0;
    for (const car of state.cars) if (car.kind === 'police' && !car.wrecked) have += 1;
    let attempts = 0;
    while (have < want && attempts < 8) {
      attempts += 1;
      const s = city.randomStreetPoint();
      // Spawn on a street some distance from the player.
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      if (dx * dx + dz * dz < POLICE.spawnDistance * POLICE.spawnDistance) continue;
      const car = makeCar('police', s.x, s.z, Math.atan2(p.x - s.x, p.z - s.z), 0x1c1e24);
      car.speed = POLICE.speed;
      state.cars.push(car);
      have += 1;
      break;
    }
    if (state.wanted === 0) {
      for (const car of state.cars) {
        if (car.kind === 'police') {
          car.wrecked = true; // despawn: the renderer hides wrecked police
          car.despawned = true;
        }
      }
    }
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.wrecked) continue;
      if (car.ramCd > 0) car.ramCd -= dt;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
      const wantAngle = Math.atan2(dx, dz);
      car.angle = angleLerp(car.angle, wantAngle, Math.min(1, 2.2 * dt));
      // A cop pulls up slowly on a player on foot and stops beside them to make the bust;
      // against a car it comes in fast to ram.
      const chaseSpeed = p.onFoot
        ? (dist < 4 ? 0 : dist < 10 ? 3 : POLICE.speed + POLICE.speedPerStar * state.wanted)
        : POLICE.speed + POLICE.speedPerStar * state.wanted;
      car.speed += (chaseSpeed - car.speed) * Math.min(1, 1.5 * dt);
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      const hit = collideCircle(car.x, car.z, CAR.radius, city.colliders);
      car.x = hit.x;
      car.z = hit.z;
      if (dist < POLICE.ramRange && car.ramCd <= 0) {
        car.ramCd = POLICE.ramCooldown;
        if (!p.onFoot) {
          const playerCar = state.cars[p.carId];
          if (playerCar && !playerCar.wrecked) {
            playerCar.health -= POLICE.ramDamage;
            playerCar.speed *= 0.6;
            if (playerCar.health <= 0) {
              playerCar.wrecked = true;
              p.onFoot = true;
              p.carId = -1;
              p.x = playerCar.x + 2;
              p.z = playerCar.z + 2;
              return EVENT_WRECK;
            }
          }
        } else {
          damagePlayer(POLICE.ramDamage);
          return EVENT_HIT;
        }
      }
      // Bust: on foot, slow, and a police car right on the player.
      if (p.onFoot && dist < POLICE.bustRange) {
        const playerSpeed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
        if (playerSpeed < 1.5) {
          car.bustTimer += dt;
          if (car.bustTimer > POLICE.bustSeconds) {
            state.busted = true;
            return EVENT_BUSTED;
          }
        } else car.bustTimer = 0;
      } else car.bustTimer = 0;
    }
    return 0;
  }

  function step(dt, input) {
    if (state.busted || state.wasted) return 0;
    let events = 0;
    state.time += dt;
    const p = state.player;

    if (input.enter) {
      events |= p.onFoot ? enterCar() : exitCar();
    }
    if (input.punch && p.onFoot) events |= punch();
    if (p.onFoot) stepPlayerOnFoot(dt, input);
    else events |= stepPlayerCar(dt, input);

    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);

    // Cars never overlap: push any two cars apart.
    for (let i = 0; i < state.cars.length; i += 1) {
      const a = state.cars[i];
      if (a.wrecked) continue;
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const b = state.cars[j];
        if (b.wrecked) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= 3.4 * 3.4 || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = (3.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        a.speed *= 0.98;
        b.speed *= 0.98;
      }
    }

    // Wanted decay: quiet for a while and no police close by.
    if (state.wanted > 0) {
      state.wantedQuiet += dt;
      let policeNear = false;
      for (const car of state.cars) {
        if (car.kind !== 'police' || car.wrecked) continue;
        const dx = car.x - p.x;
        const dz = car.z - p.z;
        if (dx * dx + dz * dz < 40 * 40) { policeNear = true; break; }
      }
      if (!policeNear && state.wantedQuiet > WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedQuiet = 0;
      }
    }

    // Health slowly recovers out of trouble.
    if (p.hurtTimer <= 0 && p.health > 0 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + 2 * dt);
    }

    // Cash bags.
    for (let i = 0; i < state.cashBags.length; i += 1) {
      const bag = state.cashBags[i];
      if (bag.taken) continue;
      const dx = bag.x - p.x;
      const dz = bag.z - p.z;
      if (dx * dx + dz * dz < 1.8 * 1.8) {
        bag.taken = true;
        state.cash += CASH.value;
        state.bestCash = Math.max(state.bestCash, state.cash);
        state.stats.bags += 1;
        events |= EVENT_COIN;
      }
    }

    // The fixer: take the next job with E.
    const fx = city.spots.plaza.x - p.x;
    const fz = city.spots.plaza.z - p.z;
    state.nearFixer = missions.active === -1 && missions.nextIndex() !== -1 && (fx * fx + fz * fz) < 16;
    if (state.nearFixer && input.enter) {
      startMission(missions.nextIndex());
    }
    state.prompt = state.nearFixer ? 'Press E — take Vera’s job' : '';

    // Missions.
    const outcome = missions.update(dt, p);
    if (outcome) {
      if (outcome.kind === 'step') events |= EVENT_MISSION_STEP;
      else if (outcome.kind === 'done') {
        state.cash += outcome.payout;
        state.bestCash = Math.max(state.bestCash, state.cash);
        state.stats.missions += 1;
        state.lastPayout = outcome.payout;
        p.health = Math.min(PLAYER.health, p.health + 25);
        events |= EVENT_MISSION_DONE;
      } else if (outcome.kind === 'failed') events |= EVENT_MISSION_FAIL;
    }
    return events;
  }

  function getSave() {
    return {
      cash: state.cash,
      bestCash: state.bestCash,
      missionsDone: missions.done.slice(),
      cashTaken: state.cashBags.map((b) => b.taken),
    };
  }

  function applySave(save) {
    if (!save || typeof save !== 'object') return;
    if (typeof save.cash === 'number') state.cash = save.cash;
    if (typeof save.bestCash === 'number') state.bestCash = save.bestCash;
    if (Array.isArray(save.missionsDone)) {
      for (let i = 0; i < 3 && i < save.missionsDone.length; i += 1) missions.done[i] = !!save.missionsDone[i];
    }
    if (Array.isArray(save.cashTaken)) {
      for (let i = 0; i < save.cashTaken.length && i < state.cashBags.length; i += 1) {
        state.cashBags[i].taken = !!save.cashTaken[i];
      }
    }
  }

  reset();
  return {
    state, missions, reset, step, addWanted, startMission, getSave, applySave,
    get objective() { return missions.objective(); },
    get target() { return missions.target(); },
  };
}
