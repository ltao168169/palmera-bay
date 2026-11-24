// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, so the frame is what a short
// game really looks like and the same seed always gives the same frame. The camera pose is
// returned with the screen so the main loop can paint it.

import { STEP } from './config.js';

function driveForward(world, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { moveX: steer || 0, moveY: 1, run: false, jump: false, punch: false, enter: false, handbrake: false, camYaw: world.state.player.heading + Math.PI });
  }
}

// Drive at a capped speed so the police (who top out near 19 m/s) can close in
// and appear in the frame instead of trailing forever behind the camera.
function cruiseForward(world, seconds, targetSpeed) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = world.state.cars[world.state.player.carId];
    const speed = car ? Math.abs(car.speed) : 0;
    world.step(STEP, { moveX: 0, moveY: speed < targetSpeed ? 1 : 0, run: false, jump: false, punch: false, enter: false, handbrake: false, camYaw: world.state.player.heading + Math.PI });
  }
}

function walkForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { moveX: 0, moveY: 1, run: false, jump: false, punch: false, enter: false, handbrake: false, camYaw: world.state.player.heading + Math.PI });
  }
}

function getInParkedCar(world) {
  const p = world.state.player;
  const car = world.state.cars[0];
  p.x = car.x + 2.5;
  p.z = car.z;
  world.step(STEP, { moveX: 0, moveY: 0, run: false, jump: false, punch: false, enter: true, handbrake: false, camYaw: car.angle + Math.PI });
  return car;
}

// Move the player's car (and the player with it) to a chosen pose. The staged scenes
// drive a straight line, so starting on the beach road — the one stretch with no
// buildings, no intersections and the ocean beside it — keeps the car moving instead
// of wedged against a wall or off the north edge of the city (v2 staging fix).
function placePlayerCar(world, x, z, angle) {
  const p = world.state.player;
  const car = world.state.cars[p.carId];
  if (!car) return;
  car.x = x;
  car.z = z;
  car.angle = angle;
  car.speed = 0;
  p.x = x;
  p.z = z;
  p.heading = angle;
}

export function stageShot(name, world) {
  world.reset();
  const p = world.state.player;
  if (name === 'drive') {
    const car = getInParkedCar(world);
    // Down the beach road, ocean on the left, so the frame is a coastal drive.
    placePlayerCar(world, 156, -90, 0);
    driveForward(world, 6, 0);
    return { screen: 'play', camYaw: car.angle + Math.PI, camPitch: 0.32, camDist: 13 };
  }
  if (name === 'chase') {
    const car = getInParkedCar(world);
    // Stealing the parked car already raised wanted to 1, so addWanted(3) here would
    // stage 4 stars while the shot is meant to show 3 (v1 drift). Set it exactly:
    // 3 stars, three police cars, and re-assert after the drive in case the drive
    // itself committed a crime (e.g. clipping a pedestrian).
    world.state.wanted = 3;
    world.state.wantedQuiet = 0;
    // Chase down the beach road so the police have a clear run at the player: 5 s at
    // full speed, then 3 s cruising at 12 m/s so the police (top speed ~19 m/s) close
    // in. The camera sits rear-side so the closing police are in the frame, not
    // hidden behind the camera the way a straight rear view hides them.
    placePlayerCar(world, 156, -120, 0);
    driveForward(world, 5, 0);
    cruiseForward(world, 3, 12);
    world.state.wanted = 3;
    world.state.wantedQuiet = 0;
    return { screen: 'play', camYaw: car.angle + Math.PI + 0.7, camPitch: 0.32, camDist: 16 };
  }
  if (name === 'mission') {
    world.startMission(0);
    const car = getInParkedCar(world);
    // Start on the beach road just north of the docks pickup: the run to the package
    // crosses sand, not buildings, so the car arrives instead of wedging into a wall.
    placePlayerCar(world, 156, -40, 0);
    // Head toward the docks pickup: steer the car by aiming at it.
    const target = world.target;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const wantAngle = Math.atan2(dx, dz);
    const steps = Math.round(5 / STEP);
    for (let i = 0; i < steps; i += 1) {
      const carNow = world.state.cars[p.carId];
      let steer = 0;
      if (carNow) {
        let d = wantAngle - carNow.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        steer = d > 0.15 ? 1 : d < -0.15 ? -1 : 0;
      }
      world.step(STEP, { moveX: steer, moveY: 1, run: false, jump: false, punch: false, enter: false, handbrake: false, camYaw: p.heading + Math.PI });
    }
    return { screen: 'play', camYaw: p.heading + Math.PI, camPitch: 0.34, camDist: 12 };
  }
  // start: the title screen over a living city.
  walkForward(world, 5);
  p.x = 160;
  p.z = 40;
  p.heading = Math.PI / 2;
  return { screen: 'title', camYaw: Math.PI * 0.72, camPitch: 0.22, camDist: 16 };
}
