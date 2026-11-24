// Keyboard and pointer input. Held keys give a movement vector; one-shot presses (jump,
// punch, enter a car, pause, confirm) are queued as bit flags and taken once by the loop, so
// a press between two frames is never lost and never counted twice. Dragging the mouse
// orbits the camera; the wheel zooms it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;
export const ACTION_PUNCH = 8;
export const ACTION_ENTER = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP = new Set(['Space']);
const PUNCH = new Set(['KeyF']);
const ENTER = new Set(['KeyE']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HANDBRAKE = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (RUN.has(event.code)) {
      held.add(event.code);
    } else if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP;
      event.preventDefault();
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });

  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    target.setPointerCapture(event.pointerId);
  });
  target.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitDX += event.clientX - lastX;
    orbitDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  function endDrag() {
    dragging = false;
  }
  target.addEventListener('pointerup', endDrag);
  target.addEventListener('pointercancel', endDrag);
  target.addEventListener('wheel', (event) => {
    wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement keys as x (strafe right) and y (forward), each -1, 0 or 1. */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
      return { x, y };
    },
    runHeld() {
      return hasAny(RUN);
    },
    handbrakeHeld() {
      return hasAny(HANDBRAKE);
    },
    /** Mouse orbit since the last call, in pixels; wheel zoom since the last call. */
    takeOrbit() {
      const out = { dx: orbitDX, dy: orbitDY, wheel };
      orbitDX = 0;
      orbitDY = 0;
      wheel = 0;
      return out;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
