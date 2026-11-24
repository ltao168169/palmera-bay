// Every tuning number and colour in one place. The city is a 6x6 grid of blocks on a 48 m
// pitch, with a beach and ocean on the +X side and a pier at z = 0. Nothing here depends on
// the screen size; the renderer scales to the window.
//
// Palmera Bay v2: 18 cash bags (was 12), 16 traffic cars (was 12), two extra car colours,
// and a marina with moored boats off the beach road.

/** The build's version, shown on the title screen and in the self-test header. */
export const VERSION = '2.0.0';

export const STEP = 1 / 60;

export const CITY = {
  block: 36,
  street: 12,
  pitch: 48,
  grid: 6,
  half: 144, // outer street centre line
  ground: 156, // ground plane half-size
  beachX0: 150, // sand starts
  oceanX0: 188, // water starts
  pierX0: 186,
  pierX1: 238,
  pierHalfWidth: 4,
  bound: 250, // world bounds for the player
};

export const PLAYER = {
  radius: 0.45,
  height: 1.8,
  walkSpeed: 5,
  runSpeed: 9.5,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: 22,
  health: 100,
  punchRange: 1.9,
  punchDamage: 12,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 4.4,
  width: 1.9,
  radius: 1.7,
  accel: 16,
  brake: 28,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 9,
  steerRate: 2.1,
  grip: 6,
  health: 100,
};

export const TRAFFIC = { count: 16, speed: 8, speedJitter: 2.5 };
export const PARKED = { count: 10 };
export const PEDS = { count: 24, walkSpeed: 1.5, runSpeed: 4.5 };
export const CASH = { count: 18, value: 50 };
export const BOATS = { count: 4 };

export const WANTED = {
  max: 5,
  decaySeconds: 40, // one star fades after this long with no crime and no police near
  policePerStar: 1,
  maxPolice: 4,
};

export const POLICE = {
  speed: 14,
  speedPerStar: 1.6,
  ramDamage: 9,
  ramCooldown: 0.9,
  ramRange: 2.8,
  bustRange: 3.2,
  bustSeconds: 2.5,
  spawnDistance: 70,
};

export const PALETTE = {
  skyTop: 0x5ea9dd,
  skyHorizon: 0xffd9a0,
  fog: 0xf2c184,
  ground: 0x5d6460,
  road: 0x3c4148,
  roadLine: 0xd8c95a,
  sidewalk: 0x9aa0a3,
  sand: 0xe6cf96,
  ocean: 0x2e7fb8,
  oceanDeep: 0x1d5f8f,
  pierWood: 0x8a6b4a,
  building: [0xc9a06a, 0xb08a5e, 0x9a7b68, 0x7d94a8, 0xa89080, 0x8fa08a, 0xc47f5a, 0x6f87a0],
  roof: 0x4a4440,
  windowLit: 0xffd27a,
  windowDark: 0x2c3a4a,
  car: [0xc23b2e, 0x2e6fc2, 0xe8b73a, 0x3aa655, 0xd8d8d8, 0x222226, 0x7a4fc2, 0xe07a2e, 0x14b8a6, 0xd946ef],
  policeBody: 0x1c1e24,
  policeDoor: 0xe8e8e8,
  playerShirt: 0x2e8f6e,
  playerPants: 0x2c3242,
  pedShirt: [0xc25a7a, 0x5a8fc2, 0xd8a03a, 0x6a9a5a, 0x8a5ac2, 0xc2683a],
  cash: 0x37d67a,
  marker: 0xffd94a,
  health: 0x43d17a,
  wanted: 0xffd94a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'palmera-bay.save.v1';
