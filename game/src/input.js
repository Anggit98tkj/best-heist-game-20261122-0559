// Keyboard and mouse, turned into one input object per step plus one-shot actions.
// Movement: WASD or arrows. SHIFT runs (fast, loud, easy to spot). C sneaks
// (slow, quiet, hard to spot). Click walks the crew there. F fires the EMP,
// G tosses a decoy coin, P pauses, M mutes, R restarts the current job
// (or the whole run from an end screen).
import { H, W } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_EMP = 8;
export const ACTION_DECOY = 16;
export const ACTION_RESTART = 32;

const keys = {};
let queued = 0;
let click = null;

export function createInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyM') queued |= ACTION_MUTE;
    else if (e.code === 'KeyF') queued |= ACTION_EMP;
    else if (e.code === 'KeyG') queued |= ACTION_DECOY;
    else if (e.code === 'KeyR') queued |= ACTION_RESTART;
    else if (e.code === 'Space' || e.code === 'Enter') queued |= ACTION_CONFIRM;
    else if (e.code === 'KeyP' || e.code === 'Escape') queued |= ACTION_PAUSE;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // primary button only; the rest is not a move order
    const rect = canvas.getBoundingClientRect();
    const gx = ((e.clientX - rect.left) / rect.width) * W;
    const gy = ((e.clientY - rect.top) / rect.height) * H;
    click = { x: gx, y: gy };
    queued |= ACTION_CONFIRM;
  });

  // A right-click over the game is not a move order either.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    // The movement the world steps with this frame: -1..1 on each axis.
    direction() {
      let mx = 0;
      let my = 0;
      if (keys.ArrowLeft || keys.KeyA) mx -= 1;
      if (keys.ArrowRight || keys.KeyD) mx += 1;
      if (keys.ArrowUp || keys.KeyW) my -= 1;
      if (keys.ArrowDown || keys.KeyS) my += 1;
      return {
        mx,
        my,
        run: !!(keys.ShiftLeft || keys.ShiftRight),
        sneak: !!(keys.KeyC || keys.ControlLeft || keys.ControlRight),
      };
    },
    // One-shot actions since the last call; reading clears them.
    takeActions() {
      const a = queued;
      queued = 0;
      return a;
    },
    // The last click point in game coordinates, if any; reading clears it.
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
  };
}
