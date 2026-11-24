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

export function stageShot(name, world) {
  world.reset();
  const p = world.state.player;
  if (name === 'drive') {
    const car = getInParkedCar(world);
    driveForward(world, 6, 0);
    return { screen: 'play', camYaw: car.angle + Math.PI, camPitch: 0.32, camDist: 13 };
  }
  if (name === 'chase') {
    const car = getInParkedCar(world);
    world.addWanted(3);
    driveForward(world, 8, 0);
    return { screen: 'play', camYaw: car.angle + Math.PI, camPitch: 0.3, camDist: 14 };
  }
  if (name === 'mission') {
    world.startMission(0);
    const car = getInParkedCar(world);
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
