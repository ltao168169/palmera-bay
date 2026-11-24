// The story work: three jobs from fixer Vera Solano, each a short chain of "go here" steps
// with a payout at the end. The runner holds which job and step the player is on; the world
// feeds it positions and it answers with the objective text, the marker position and whether
// a job was completed or failed. Nothing here draws or steps the world itself.

export const MISSIONS = [
  {
    id: 'first-light',
    name: 'First Light',
    giver: 'Vera Solano',
    brief: 'A package is waiting at the docks. Bring it to Club Nova — no questions, no police.',
    reward: 300,
    steps: [
      { label: 'Pick up the package at the docks', target: 'pickup', radius: 3.5 },
      { label: 'Deliver the package to Club Nova', target: 'dropoff', radius: 4 },
    ],
  },
  {
    id: 'night-shift',
    name: 'Night Shift',
    giver: 'Vera Solano',
    brief: 'A guest is waiting outside the hotel. Get them to the marina — and hurry, the meter is running.',
    reward: 250,
    tip: 100,
    steps: [
      { label: 'Pick up the passenger at the hotel', target: 'passenger', radius: 3.5 },
      { label: 'Get the passenger to the marina', target: 'marina', radius: 4, timer: 90 },
    ],
  },
  {
    id: 'coastline-run',
    name: 'Coastline Run',
    giver: 'Vera Solano',
    brief: 'The coast road is hot tonight. Hit every checkpoint and reach the end of the pier — the cops will be watching.',
    reward: 500,
    wantedOnStart: 2,
    steps: [
      { label: 'Checkpoint 1 of 6 — beach road', target: 'checkpoint0', radius: 6 },
      { label: 'Checkpoint 2 of 6 — beach road', target: 'checkpoint1', radius: 6 },
      { label: 'Checkpoint 3 of 6 — beach road', target: 'checkpoint2', radius: 6 },
      { label: 'Checkpoint 4 of 6 — beach road', target: 'checkpoint3', radius: 6 },
      { label: 'Checkpoint 5 of 6 — beach road', target: 'checkpoint4', radius: 6 },
      { label: 'Final checkpoint — end of the pier', target: 'checkpoint5', radius: 6, timer: 80 },
    ],
  },
];

function targetPos(spots, name) {
  if (name.startsWith('checkpoint')) return spots.checkpoints[Number(name.slice(10))];
  return spots[name];
}

export function createMissions(spots) {
  const done = [false, false, false];
  let active = -1; // index into MISSIONS, or -1
  let step = 0;
  let timer = 0;

  function current() {
    return active === -1 ? null : MISSIONS[active];
  }

  function objective() {
    if (active === -1) {
      const next = done.findIndex((d) => !d);
      if (next === -1) return 'All jobs done — Palmera Bay is yours. Spend it well.';
      return 'Vera has work. Meet her at the plaza (yellow marker).';
    }
    return current().steps[step].label;
  }

  function target() {
    if (active === -1) return spots.plaza;
    return targetPos(spots, current().steps[step].target);
  }

  function start(index) {
    if (active !== -1 || done[index]) return false;
    active = index;
    step = 0;
    const first = current().steps[0];
    timer = first.timer ?? 0;
    return true;
  }

  function cancel() {
    active = -1;
    step = 0;
    timer = 0;
  }

  /**
   * Advance the active job. `pos` is the player's position; returns null, or an outcome:
   * { kind: 'step' } when a step was reached, { kind: 'done', payout } when the job paid out,
   * { kind: 'failed' } when a timer ran out.
   */
  function update(dt, pos) {
    if (active === -1) return null;
    const job = current();
    const stepDef = job.steps[step];
    if (stepDef.timer && timer > 0) {
      timer -= dt;
      if (timer <= 0) {
        cancel();
        return { kind: 'failed' };
      }
    }
    const t = targetPos(spots, stepDef.target);
    const dx = pos.x - t.x;
    const dz = pos.z - t.z;
    if (dx * dx + dz * dz > stepDef.radius * stepDef.radius) return null;
    step += 1;
    if (step >= job.steps.length) {
      let payout = job.reward;
      if (job.tip && timer > 0) payout += Math.round(job.tip * (timer / 90));
      done[active] = true;
      const finished = active;
      active = -1;
      step = 0;
      timer = 0;
      return { kind: 'done', payout, job: MISSIONS[finished] };
    }
    const next = job.steps[step];
    timer = next.timer ?? 0;
    return { kind: 'step' };
  }

  return {
    done, current, objective, target, start, cancel, update,
    get active() { return active; },
    get step() { return step; },
    get timer() { return timer; },
    nextIndex() { return done.findIndex((d) => !d); },
  };
}
