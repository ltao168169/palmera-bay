// The HUD: DOM elements over the canvas — health, cash, wanted stars, speed, objective,
// timer, toasts — plus a 2D canvas minimap drawn from the city and the world state, and the
// title, pause and end screens. It never touches the simulation; it only reads state.

import { CITY } from './config.js';

const STAR_ON = '★';
const STAR_OFF = '☆';

export function createHud(doc, city) {
  const el = (id) => doc.getElementById(id);
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const cashText = el('cash');
  const starsText = el('stars');
  const speedText = el('speed');
  const objectiveText = el('objective');
  const timerText = el('timer');
  const promptText = el('prompt');
  const toastBox = el('toasts');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    end: el('screen-end'),
  };
  const endTitle = el('end-title');
  const endText = el('end-text');
  const titleBest = el('title-best');
  let toastTimer = 0;

  function toast(message, ms) {
    const div = doc.createElement('div');
    div.className = 'toast';
    div.textContent = message;
    toastBox.appendChild(div);
    window.setTimeout(() => div.remove(), ms || 3600);
  }

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('hidden', key !== name);
    }
  }

  function drawMinimap(state) {
    const size = minimap.width;
    const half = CITY.bound;
    const scale = size / (half * 2);
    const toMap = (x, z) => [(x + half) * scale, (z + half) * scale];
    mapCtx.fillStyle = '#20242c';
    mapCtx.fillRect(0, 0, size, size);
    // Ocean and beach on the east edge.
    const [ox] = toMap(CITY.oceanX0, 0);
    mapCtx.fillStyle = '#2e7fb8';
    mapCtx.fillRect(ox, 0, size - ox, size);
    const [bx] = toMap(CITY.beachX0, 0);
    mapCtx.fillStyle = '#e6cf96';
    mapCtx.fillRect(bx, 0, ox - bx, size);
    // Roads.
    mapCtx.strokeStyle = '#565c66';
    mapCtx.lineWidth = 2;
    for (const line of city.lines) {
      const [lx] = toMap(line, 0);
      const [, lz] = toMap(0, line);
      mapCtx.beginPath(); mapCtx.moveTo(lx, 0); mapCtx.lineTo(lx, size); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, lz); mapCtx.lineTo(size, lz); mapCtx.stroke();
    }
    // Buildings.
    mapCtx.fillStyle = '#3a3f47';
    for (const b of city.buildings) {
      const [x, z] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      mapCtx.fillRect(x, z, b.w * scale, b.d * scale);
    }
    // Cash bags.
    mapCtx.fillStyle = '#37d67a';
    for (const bag of state.cashBags) {
      if (bag.taken) continue;
      const [x, z] = toMap(bag.x, bag.z);
      mapCtx.fillRect(x - 2, z - 2, 4, 4);
    }
    // Mission target.
    if (state.target) {
      const [x, z] = toMap(state.target.x, state.target.z);
      mapCtx.fillStyle = '#ffd94a';
      mapCtx.beginPath();
      mapCtx.arc(x, z, 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.fillStyle = '#20242c';
      mapCtx.font = 'bold 9px sans-serif';
      mapCtx.textAlign = 'center';
      mapCtx.textBaseline = 'middle';
      mapCtx.fillText('!', x, z);
    }
    // Police cars.
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.wrecked || car.despawned) continue;
      const [x, z] = toMap(car.x, car.z);
      mapCtx.fillStyle = '#ff5a5a';
      mapCtx.beginPath();
      mapCtx.arc(x, z, 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player.
    const p = state.player;
    const [px, pz] = toMap(p.x, p.z);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(px + Math.sin(p.heading) * 7, pz + Math.cos(p.heading) * 7);
    mapCtx.lineTo(px + Math.sin(p.heading + 2.5) * 5, pz + Math.cos(p.heading + 2.5) * 5);
    mapCtx.lineTo(px + Math.sin(p.heading - 2.5) * 5, pz + Math.cos(p.heading - 2.5) * 5);
    mapCtx.closePath();
    mapCtx.fill();
  }

  function update(state, missions, dt) {
    const p = state.player;
    const health = Math.max(0, Math.round(p.health));
    healthFill.style.width = `${health}%`;
    healthFill.style.background = health > 50 ? '#43d17a' : health > 25 ? '#e8b73a' : '#e5534b';
    healthText.textContent = `HP ${health}`;
    cashText.textContent = `$${state.cash.toLocaleString('en-US')}`;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? STAR_ON : STAR_OFF;
    starsText.textContent = stars;
    starsText.classList.toggle('hot', state.wanted > 0);
    let speed = 0;
    if (!p.onFoot && p.carId >= 0 && state.cars[p.carId]) speed = Math.abs(state.cars[p.carId].speed) * 3.6;
    else speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz) * 3.6;
    speedText.textContent = `${Math.round(speed)} km/h`;
    objectiveText.textContent = missions.objective();
    const timer = missions.timer;
    timerText.textContent = timer > 0 ? `⏱ ${Math.ceil(timer)}s` : '';
    timerText.classList.toggle('urgent', timer > 0 && timer < 15);
    promptText.textContent = state.prompt || '';
    if (toastTimer > 0) toastTimer -= dt;
    drawMinimap(state);
  }

  return {
    toast, showScreen, update,
    showEnd(title, text) {
      endTitle.textContent = title;
      endText.textContent = text;
      showScreen('end');
    },
    setTitleBest(bestCash, missionsDone) {
      titleBest.textContent = bestCash > 0
        ? `Best cash $${bestCash.toLocaleString('en-US')} · ${missionsDone} of 3 jobs done`
        : 'New to Palmera Bay — make your first dollar.';
    },
  };
}
