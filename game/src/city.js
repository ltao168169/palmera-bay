// The city itself, built once from a seed: street grid, building footprints, parks, the
// beach, the ocean and the pier, plus every spawn point the game needs. It holds no
// rendering and no browser: the world steps on this data and the renderer draws it.

import { BOATS, CITY, PALETTE } from './config.js';
import { chance, pick, range, rangeInt, shuffle } from './random.js';

/** The street centre lines, both axes: -144, -96, -48, 0, 48, 96, 144. */
export function streetLines() {
  const lines = [];
  for (let i = 0; i <= CITY.grid; i += 1) lines.push(-CITY.half + i * CITY.pitch);
  return lines;
}

function blockCentres() {
  const centres = [];
  for (let i = 0; i < CITY.grid; i += 1) centres.push(-CITY.half + CITY.pitch / 2 + i * CITY.pitch);
  return centres;
}

/** Push a circle out of every building box; returns the corrected position and whether it hit. */
export function collideCircle(x, z, radius, colliders) {
  let hit = false;
  for (let index = 0; index < colliders.length; index += 1) {
    const b = colliders[index];
    const cx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
    const cz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.000001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the shallowest axis.
      const px = b.hx + radius - Math.abs(x - b.x);
      const pz = b.hz + radius - Math.abs(z - b.z);
      if (px < pz) x = b.x + (x < b.x ? -1 : 1) * (b.hx + radius);
      else z = b.z + (z < b.z ? -1 : 1) * (b.hz + radius);
    }
  }
  return { x, z, hit };
}

export function buildCity(rng) {
  const lines = streetLines();
  const centres = blockCentres();
  const buildings = [];
  const colliders = [];
  const parks = [];
  const plaza = { x: -24, z: -24 };

  // Two park blocks, never the plaza block. Shuffle the blocks and take the first two
  // that are not the plaza — the same seed always picks the same parks.
  const parkBlocks = [];
  const shuffled = shuffle(rng, centres.flatMap((bx) => centres.map((bz) => ({ x: bx, z: bz }))));
  for (const block of shuffled) {
    if (block.x === plaza.x && block.z === plaza.z) continue;
    parkBlocks.push(block);
    if (parkBlocks.length === 2) break;
  }
  for (const p of parkBlocks) parks.push({ x: p.x, z: p.z, w: CITY.block - 8, d: CITY.block - 8 });

  for (const bx of centres) {
    for (const bz of centres) {
      if (bx === plaza.x && bz === plaza.z) continue;
      if (parkBlocks.some((p) => p.x === bx && p.z === bz)) continue;
      const count = rangeInt(rng, 1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 12, 22);
        const d = range(rng, 12, 22);
        const ox = count === 1 ? 0 : range(rng, -7, 7);
        const oz = count === 1 ? 0 : range(rng, -7, 7);
        const x = bx + ox;
        const z = bz + oz;
        const h = range(rng, 8, 42);
        buildings.push({ x, z, w, d, h, color: pick(rng, PALETTE.building), seed: rng() });
        colliders.push({ x, z, hx: w / 2, hz: d / 2 });
      }
    }
  }

  // Streetlights along the streets, alternating sides.
  const lights = [];
  for (const line of lines) {
    for (let s = -CITY.half; s <= CITY.half; s += CITY.pitch) {
      if (chance(rng, 0.5)) lights.push({ x: line + 5.5, z: s });
      else lights.push({ x: s, z: line + 5.5 });
    }
  }

  // Palms down the beach and a few in the parks.
  const palms = [];
  for (let z = -132; z <= 132; z += 24) palms.push({ x: 158 + range(rng, -2, 2), z: z + range(rng, -4, 4) });
  for (const p of parks) {
    for (let n = 0; n < 4; n += 1) palms.push({ x: p.x + range(rng, -10, 10), z: p.z + range(rng, -10, 10) });
  }

  // Parked cars along the curbs, parallel to the street (v2: nose-in parking made the
  // first drive run straight into a building; parallel cars pull out down the street).
  const parked = [];
  for (let n = 0; n < 10; n += 1) {
    const along = pick(rng, lines);
    const at = range(rng, -132, 132);
    const side = chance(rng, 0.5) ? 1 : -1;
    if (chance(rng, 0.5)) parked.push({ x: at, z: along + side * 4.2, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2, color: pick(rng, PALETTE.car) });
    else parked.push({ x: along + side * 4.2, z: at, angle: side > 0 ? 0 : Math.PI, color: pick(rng, PALETTE.car) });
  }

  // Cash bags: twelve on the streets (by the curb, always reachable), three on the
  // beach, two out on the pier, and one in the first park. v2: 18 bags (was 12).
  const cashSpots = [];
  for (let n = 0; n < 12; n += 1) {
    const along = pick(rng, lines);
    const at = range(rng, -132, 132);
    const side = chance(rng, 0.5) ? 1 : -1;
    if (chance(rng, 0.5)) cashSpots.push({ x: at, z: along + side * 4.2 });
    else cashSpots.push({ x: along + side * 4.2, z: at });
  }
  cashSpots.push({ x: 168, z: -60 });
  cashSpots.push({ x: 168, z: 96 });
  cashSpots.push({ x: 168, z: 120 });
  cashSpots.push({ x: 210, z: 0 });
  cashSpots.push({ x: 224, z: 0 });
  cashSpots.push({ x: parks[0].x, z: parks[0].z });

  // The spots the missions use.
  const spots = {
    plaza: { x: plaza.x, z: plaza.z },
    pickup: { x: 168, z: 24 }, // the docks, by the pier
    dropoff: { x: 72, z: 52 }, // Club Nova, on the sidewalk outside its block
    passenger: { x: -72, z: -52 }, // the hotel, on the sidewalk outside its block
    marina: { x: 156, z: -96 }, // the marina, down the beach road
    stash0: { x: 168, z: -120 }, // Harbor Lights crate 1: on the beach
    stash1: { x: -96, z: 48 }, // Harbor Lights crate 2: an old-town intersection
    stash2: { x: 48, z: 144 }, // Harbor Lights crate 3: the marina road
    hideout: { x: 232, z: 0 }, // Harbor Lights drop: the end of the pier
    checkpoints: [
      { x: 156, z: -120 }, { x: 156, z: -60 }, { x: 156, z: 0 },
      { x: 156, z: 60 }, { x: 156, z: 120 }, { x: 232, z: 0 },
    ],
  };

  // Moored boats off the marina, bobbing on the water. They are scenery with a pulse:
  // the renderer animates them, and the harbour horn sounds when Harbor Lights starts.
  const boats = [
    { x: 205, z: -108, angle: 0.4, color: 0xe8e8e8, phase: 0 },
    { x: 218, z: -84, angle: -0.3, color: 0xc23b2e, phase: 1.7 },
    { x: 208, z: -60, angle: 0.9, color: 0x2e6fc2, phase: 3.1 },
    { x: 226, z: -120, angle: 0.1, color: 0xe8b73a, phase: 4.4 },
  ].slice(0, BOATS.count);

  function nearestStreet(v) {
    let best = lines[0];
    for (const line of lines) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
    return best;
  }

  function isOnRoad(x, z) {
    return Math.abs(x - nearestStreet(x)) < CITY.street / 2 || Math.abs(z - nearestStreet(z)) < CITY.street / 2;
  }

  /** A random point on a street, with the heading along it. */
  function randomStreetPoint() {
    const along = pick(rng, lines);
    const at = range(rng, -132, 132);
    if (chance(rng, 0.5)) return { x: at, z: along, heading: chance(rng, 0.5) ? 0 : Math.PI };
    return { x: along, z: at, heading: chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }

  /** Keep a point inside the playable area: the city, the beach and the pier, never the water. */
  function clampToWorld(x, z) {
    const onPier = Math.abs(z) < CITY.pierHalfWidth - 0.5 && x > CITY.pierX0 - 2;
    const maxX = onPier ? CITY.pierX1 : CITY.oceanX0 - 1;
    return {
      x: Math.max(-CITY.bound, Math.min(maxX, x)),
      z: Math.max(-CITY.bound, Math.min(CITY.bound, z)),
    };
  }

  return {
    lines, centres, buildings, colliders, parks, plaza, lights, palms,
    parked, cashSpots, spots, boats, nearestStreet, isOnRoad, randomStreetPoint, clampToWorld,
  };
}
