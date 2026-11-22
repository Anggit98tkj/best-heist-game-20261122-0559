// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that replans around guard and camera cones, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { COLS, ROWS, STEP, TILE } from './config.js';
import { EVENT_OVER, EVENT_WIN, findPath } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;
const END_LIMIT_SECONDS = 240;

function zeroInput() {
  return { mx: 0, my: 0, run: false, sneak: false };
}

// The careful pilot: sneak when the alarm is climbing, run only when chased,
// and route around every cone it can see. It replans often because the guards
// (and their cones) keep moving.
let replanIn = 0;
// Steps spent waiting for a cone to pass before entering a guarded tile.
let waitT = 0;
// The pilot waited once for this crossing already; the second time it goes
// through sneaking instead of waiting forever.
let waited = false;
// Steps spent frozen while the alarm drains; a freeze that is not draining
// the alarm is a trap, so it gives up and moves on.
let freezeT = 0;
// Where the pilot is fleeing to while seen or chased: a dark, cone-free tile
// far from every guard. Running blindly away corners the crew; running to a
// chosen safe tile is what a good player does.
let fleeTarget = null;

function nearestSafeTile(world) {
  const state = world.state;
  const p = state.player;
  const pc = Math.floor(p.x / TILE);
  const pr = Math.floor(p.y / TILE);
  const solid = (c, r) => world.state.map[r] && '#C'.includes(world.state.map[r][c] ?? '#');
  for (let ring = 1; ring <= 7; ring += 1) {
    const found = [];
    for (let dc = -ring; dc <= ring; dc += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = pc + dc;
        const r = pr + dr;
        if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
        if (solid(c, r)) continue;
        if (world.tileDanger(c, r)) continue;
        let clear = true;
        for (const g of state.guards) {
          if (Math.hypot(g.x - (c * TILE + TILE / 2), g.y - (r * TILE + TILE / 2)) < 170) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        // Darkness first: a dark tile hides the crew while the alarm drains.
        const dark = world.state.map[r][c] === 'D' ? 0 : 1;
        found.push([dark, Math.abs(dc) + Math.abs(dr), c, r]);
      }
    }
    if (found.length) {
      found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return { col: found[0][2], row: found[0][3] };
    }
  }
  return null;
}

// Run toward the flee target (a safe tile); true when it set the movement.
function followFleeTarget(world, input) {
  const state = world.state;
  const p = state.player;
  if (!fleeTarget) fleeTarget = nearestSafeTile(world);
  if (!fleeTarget) return false;
  const pt = { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) };
  if (pt.col === fleeTarget.col && pt.row === fleeTarget.row) {
    fleeTarget = null;
    return false;
  }
  replanIn -= 1;
  if (!p.path || !p.path.length || replanIn <= 0) {
    const path = world.findPathSafe(pt.col, pt.row, fleeTarget.col, fleeTarget.row);
    p.path = path ? path.slice(1) : [];
    replanIn = 10;
  }
  if (p.path && p.path.length) {
    input.run = true;
    const node = p.path[0];
    const tx = node.col * TILE + TILE / 2;
    const ty = node.row * TILE + TILE / 2;
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (Math.abs(dx) > 4) input.mx = dx > 0 ? 1 : -1;
    if (Math.abs(dy) > 4) input.my = dy > 0 ? 1 : -1;
    return true;
  }
  fleeTarget = null;
  return false;
}

export function autopilot(world, reckless) {
  const state = world.state;
  const p = state.player;
  const input = { mx: 0, my: 0, run: false, sneak: false };
  let chaser = null;
  let chaseD = 1e9;
  for (const g of state.guards) {
    if (g.state !== 'chase') continue;
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < chaseD) {
      chaseD = d;
      chaser = g;
    }
  }
  const threatened = !reckless && (chaser !== null || state.seen);
  if (threatened) {
    // Seen or chased: get to a safe tile, fast. Fall back to running straight
    // away only when no safe tile is in reach.
    if (followFleeTarget(world, input)) return input;
    input.run = true;
    let threat = chaser;
    if (!threat) {
      let threatD = 1e9;
      for (const g of state.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < threatD) {
          threatD = d;
          threat = g;
        }
      }
    }
    if (threat) {
      const dx = p.x - threat.x;
      const dy = p.y - threat.y;
      if (Math.abs(dx) > 6) input.mx = dx > 0 ? 1 : -1;
      if (Math.abs(dy) > 6) input.my = dy > 0 ? 1 : -1;
      p.path = null;
      return input;
    }
  } else {
    fleeTarget = null;
  }
  // Spotted earlier and the alarm is still climbing: freeze and crouch while
  // hidden so the meter drains. If the freeze is not draining it, move on:
  // after 3 s frozen the pilot gets a 4 s window to move before it may
  // freeze again.
  if (!reckless && state.alarm > 30 && freezeT >= 0) {
    freezeT += 1;
    if (freezeT < 180) {
      input.sneak = true;
      return input;
    }
    freezeT = -240;
  } else if (freezeT < 0) {
    freezeT += 1;
  } else {
    freezeT = 0;
  }
  if (reckless) input.run = true;
  const target = state.loot.find((it) => !it.got) || state.exit;
  const pt = { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) };
  const tt = { col: Math.floor(target.x / TILE), row: Math.floor(target.y / TILE) };
  replanIn -= 1;
  if (!p.path || !p.path.length || replanIn <= 0) {
    const path = reckless
      ? findPath(world.state.map, pt.col, pt.row, tt.col, tt.row)
      : world.findPathSafe(pt.col, pt.row, tt.col, tt.row);
    p.path = path ? path.slice(1) : [];
    replanIn = 20;
  }
  if (p.path && p.path.length) {
    const node = p.path[0];
    const tx = node.col * TILE + TILE / 2;
    const ty = node.row * TILE + TILE / 2;
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (Math.abs(dx) > 4) input.mx = dx > 0 ? 1 : -1;
    if (Math.abs(dy) > 4) input.my = dy > 0 ? 1 : -1;
    // Sneak across tiles a cone covers; walk the safe ones.
    if (!reckless && world.tileDanger(node.col, node.row)) {
      input.sneak = true;
      if (world.tileDanger(pt.col, pt.row)) {
        // Already inside the danger: pushing forward walks into the guard.
        // Back out to a safe tile and let the patrol pass instead.
        if (followFleeTarget(world, input)) return input;
      } else if (!waited) {
        // A cone covers the next tile and this one is clear: wait for the
        // cone to sweep away instead of walking into it. A narrow corridor
        // gives nowhere to break line of sight once seen. Wait once; the
        // second time, go through sneaking rather than waiting forever.
        waitT += 1;
        if (waitT < 150) {
          input.mx = 0;
          input.my = 0;
          return input;
        }
        waitT = 0;
        waited = true;
        replanIn = 0;
      }
    } else {
      waitT = 0;
      waited = false;
    }
  }
  return input;
}

// The end scene's pilot, after the reckless run: stand still in the open
// until caught, and if no guard ever comes, walk straight at the nearest one.
function seekGuardInput(world) {
  const state = world.state;
  const p = state.player;
  const input = { mx: 0, my: 0, run: true, sneak: false };
  let best = null;
  let bestD = 1e9;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  if (!best) return input;
  const dx = best.x - p.x;
  const dy = best.y - p.y;
  if (Math.abs(dx) > 6) input.mx = dx > 0 ? 1 : -1;
  if (Math.abs(dy) > 6) input.my = dy > 0 ? 1 : -1;
  return input;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  replanIn = 0;
  fleeTarget = null;
  waitT = 0;
  waited = false;
  freezeT = 0;
  if (name === 'win') {
    // A full careful run through all three jobs: proves the game is winnable.
    let events = 0;
    for (let i = 0; i < 60 * 600; i += 1) {
      events = world.step(STEP, autopilot(world, false), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    world.state.flash = 0;
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, zeroInput(), true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const reckless = name === 'end';
  let events = 0;
  for (let i = 0; i < limit / STEP; i += 1) {
    // A cleared level already loads the next job inside step(); keep playing it.
    events = world.step(STEP, autopilot(world, reckless), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  if (name === 'end' && !(events & (EVENT_OVER | EVENT_WIN))) {
    // The reckless run survived; stand still in the open until caught.
    for (let i = 0; i < 60 * 45 && !(events & (EVENT_OVER | EVENT_WIN)); i += 1) {
      events = world.step(STEP, zeroInput(), false);
    }
  }
  if (name === 'end' && !(events & (EVENT_OVER | EVENT_WIN))) {
    // Still free: walk straight at the nearest guard until caught.
    for (let i = 0; i < 60 * 120 && !(events & (EVENT_OVER | EVENT_WIN)); i += 1) {
      events = world.step(STEP, seekGuardInput(world), false);
    }
  }
  world.state.flash = 0; // screenshots are clean, not mid-alarm-flash
  if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
  if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
