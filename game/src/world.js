// The heist rules and state, with no drawing and no browser in it: the crew member,
// patrolling guards, sweeping cameras, loot, the alarm meter, the EMP and decoy
// tools, score, lives and jobs. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about
// screens or sound. Levels are hand-built; the only randomness is cosmetic dust.
import {
  CAMERA_HALF,
  CAMERA_RANGE,
  COLS,
  CONE_HALF,
  CONE_RANGE,
  DECOY_COST,
  EMP_COST,
  LEVELS,
  LIVES,
  LOOT_POINTS,
  NOISE_RADIUS,
  ROWS,
  TILE,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_ALARM = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_LEVEL = 32;
export const EVENT_TOOL = 64;

function tileAt(map, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return map[row][col];
}

export function isSolidTile(map, col, row) {
  const t = tileAt(map, col, row);
  return t === '#' || t === 'C';
}

function isDarkTile(map, col, row) {
  return tileAt(map, col, row) === 'D';
}

// Line of sight: sampled in 4px steps, so walls and crates genuinely cut a cone off.
export function losBlocked(map, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    if (isSolidTile(map, Math.floor(x / TILE), Math.floor(y / TILE))) return true;
  }
  return false;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// How strongly a guard sees a point: 1 point blank, 0 outside the cone or behind cover.
export function guardSees(map, g, px, py) {
  const dx = px - g.x;
  const dy = py - g.y;
  const d = Math.hypot(dx, dy);
  if (d > CONE_RANGE) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), g.dir)) > CONE_HALF) return 0;
  if (losBlocked(map, g.x, g.y, px, py)) return 0;
  return 1 - d / CONE_RANGE;
}

export function cameraSees(map, c, px, py) {
  if (c.disabled > 0) return 0;
  const dx = px - c.x;
  const dy = py - c.y;
  const d = Math.hypot(dx, dy);
  if (d > CAMERA_RANGE) return 0;
  // The blind spot right under the mount: hug the wall beneath a camera
  // and it cannot see you at all.
  if (d < 26) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), c.dir)) > CAMERA_HALF) return 0;
  if (losBlocked(map, c.x, c.y, px, py)) return 0;
  return 1 - d / CAMERA_RANGE;
}

export function rayLength(map, x, y, ang, range) {
  for (let d = 8; d <= range; d += 6) {
    const px = x + Math.cos(ang) * d;
    const py = y + Math.sin(ang) * d;
    if (isSolidTile(map, Math.floor(px / TILE), Math.floor(py / TILE))) return d;
  }
  return range;
}

function circleHitsSolid(map, x, y, r) {
  const c0 = Math.floor((x - r) / TILE);
  const c1 = Math.floor((x + r) / TILE);
  const r0 = Math.floor((y - r) / TILE);
  const r1 = Math.floor((y + r) / TILE);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (!isSolidTile(map, col, row)) continue;
      const bx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const by = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      if ((x - bx) * (x - bx) + (y - by) * (y - by) < r * r) return true;
    }
  }
  return false;
}

function moveCircle(map, e, dx, dy) {
  // Axis-separated so the crew slides along walls instead of sticking.
  const nx = e.x + dx;
  if (!circleHitsSolid(map, nx, e.y, e.r)) e.x = nx;
  const ny = e.y + dy;
  if (!circleHitsSolid(map, e.x, ny, e.r)) e.y = ny;
}

// Breadth-first path on the tile grid, for click-to-move and the autopilot.
export function findPath(map, sx, sy, tx, ty) {
  const key = (c, r) => r * COLS + c;
  const prev = new Map();
  const q = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (q.length) {
    const [c, r] = q.shift();
    if (c === tx && r === ty) {
      const path = [];
      let cur = key(c, r);
      while (cur !== null) {
        path.push({ col: cur % COLS, row: Math.floor(cur / COLS) });
        cur = prev.get(cur);
      }
      path.reverse();
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (isSolidTile(map, nc, nr)) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), key(c, r));
      q.push([nc, nr]);
    }
  }
  return null;
}

export function createWorld(random) {
  const state = {
    map: null,
    levelIndex: 0,
    score: 0,
    lives: LIVES,
    time: 0,
    levelTime: 0,
    alarm: 0,
    alarms: 0,
    lootGot: 0,
    lootTotal: 0,
    player: null,
    guards: [],
    cameras: [],
    loot: [],
    exit: null,
    start: null,
    dust: [],
    message: '',
    messageT: 0,
    flash: 0,
    empT: 0,
    empCharges: 2,
    decoyCharges: 2,
    decoy: null,
    seen: false,
    best: 0,
  };

  function setMessage(m) {
    state.message = m;
    state.messageT = 3;
  }

  function loadLevel(index) {
    const def = LEVELS[index];
    state.map = def.map.map((r) => r.split(''));
    state.loot = [];
    state.guards = [];
    state.cameras = [];
    state.lootGot = 0;
    state.levelTime = 0;
    state.alarm = 0;
    state.empT = 0;
    state.empCharges = 2;
    state.decoyCharges = 2;
    state.decoy = null;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const t = state.map[row][col];
        if (t === 'P') {
          state.start = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
          state.map[row][col] = '.';
        }
        if (t === 'L') {
          state.loot.push({ col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, got: false });
          state.map[row][col] = '.';
        }
        if (t === 'E') {
          state.exit = { col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
          state.map[row][col] = '.';
        }
      }
    }
    state.lootTotal = state.loot.length;
    state.player = {
      x: state.start.x,
      y: state.start.y,
      r: 12,
      dir: 0,
      moving: false,
      running: false,
      sneaking: false,
      target: null,
      path: null,
    };
    for (const g of def.guards) {
      const pts = g.path.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
      state.guards.push({
        pts,
        wp: 0,
        x: pts[0].x,
        y: pts[0].y,
        r: 12,
        dir: 0,
        speed: g.speed,
        state: 'patrol',
        stateT: 0,
        investigate: null,
        chaseT: 0,
        lastSeen: null,
      });
    }
    for (const c of def.cameras) {
      state.cameras.push({
        x: c.col * TILE + TILE / 2,
        y: c.row * TILE + TILE / 2,
        base: c.base,
        sweep: c.sweep,
        speed: c.speed,
        dir: c.base,
        disabled: 0,
      });
    }
    // Cosmetic dust, fixed seed so every run looks identical.
    const rnd = random;
    state.dust = [];
    for (let i = 0; i < 70; i += 1) {
      state.dust.push({ x: rnd() * COLS * TILE, y: rnd() * ROWS * TILE, s: 0.6 + rnd() * 1.4, p: rnd() * 6.28 });
    }
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.time = 0;
    state.alarms = 0;
    state.levelIndex = 0;
    loadLevel(0);
  }

  function playerTile() {
    return { col: Math.floor(state.player.x / TILE), row: Math.floor(state.player.y / TILE) };
  }

  function tileDanger(col, row) {
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    for (const g of state.guards) {
      if (guardSees(state.map, g, x, y) > 0.05) return true;
      // A guard about to turn around is the trap: keep clear of the guard
      // himself, not just of the cone he is showing right now.
      if (Math.hypot(g.x - x, g.y - y) < 100) return true;
    }
    for (const c of state.cameras) {
      if (cameraSees(state.map, c, x, y) > 0.05) return true;
      // Do not stand on a camera's mount: its blind spot is small and the
      // sweep catches anything hugging it.
      if (Math.hypot(c.x - x, c.y - y) < 70) return true;
    }
    return false;
  }

  // Dijkstra path that treats tiles inside a guard or camera cone as costly,
  // so the pilot routes around sightlines instead of through them.
  function findPathSafe(sx, sy, tx, ty) {
    const key = (c, r) => r * COLS + c;
    const cost = new Map([[key(sx, sy), 0]]);
    const prev = new Map([[key(sx, sy), null]]);
    const open = [[0, sx, sy]];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i += 1) if (open[i][0] < open[bi][0]) bi = i;
      const [c0, c, r] = open.splice(bi, 1)[0];
      if (c === tx && r === ty) {
        const path = [];
        let cur = key(c, r);
        while (cur !== null) {
          path.push({ col: cur % COLS, row: Math.floor(cur / COLS) });
          cur = prev.get(cur);
        }
        path.reverse();
        return path;
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        if (isSolidTile(state.map, nc, nr)) continue;
        const nc0 = c0 + 1 + (tileDanger(nc, nr) ? 25 : 0);
        if (cost.has(key(nc, nr)) && cost.get(key(nc, nr)) <= nc0) continue;
        cost.set(key(nc, nr), nc0);
        prev.set(key(nc, nr), key(c, r));
        open.push([nc0, nc, nr]);
      }
    }
    return null;
  }

  function setClickPath(gx, gy) {
    const p = playerTile();
    const path = findPath(state.map, p.col, p.row, Math.floor(gx / TILE), Math.floor(gy / TILE));
    if (path) {
      state.player.path = path.slice(1);
      state.player.target = { x: gx, y: gy };
    }
  }

  // EMP burst: every camera goes dark for 6 seconds. Costs score.
  function useEmp() {
    if (state.empCharges <= 0 || state.empT > 0) return false;
    state.empCharges -= 1;
    state.empT = 6;
    state.score = Math.max(0, state.score - EMP_COST);
    for (const c of state.cameras) c.disabled = 6;
    setMessage('EMP burst! Cameras down for 6s.');
    return true;
  }

  // Decoy coin: tossed ahead, the nearest guard goes to look at it. Costs score.
  function useDecoy() {
    if (state.decoyCharges <= 0) return false;
    const p = state.player;
    const tx = p.x + Math.cos(p.dir) * 120;
    const ty = p.y + Math.sin(p.dir) * 120;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(tx / TILE)));
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(ty / TILE)));
    if (isSolidTile(state.map, col, row)) return false;
    state.decoyCharges -= 1;
    state.score = Math.max(0, state.score - DECOY_COST);
    state.decoy = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, t: 4 };
    let bestGuard = null;
    let bestD = 340;
    for (const g of state.guards) {
      if (g.state === 'chase') continue;
      const d = Math.hypot(g.x - state.decoy.x, g.y - state.decoy.y);
      if (d < bestD) {
        bestD = d;
        bestGuard = g;
      }
    }
    if (bestGuard) {
      bestGuard.state = 'suspicious';
      bestGuard.stateT = 0;
      bestGuard.investigate = { x: state.decoy.x, y: state.decoy.y };
    }
    setMessage('Decoy tossed. A guard goes to look.');
    return true;
  }

  function caught() {
    state.lives -= 1;
    state.flash = 0.8;
    if (state.lives <= 0) {
      loadLevel(state.levelIndex);
      return EVENT_CAUGHT | EVENT_OVER;
    }
    setMessage(`Caught! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`);
    loadLevel(state.levelIndex);
    return EVENT_CAUGHT;
  }

  // One fixed step. `input` is {mx, my, run, sneak} from the keyboard or the
  // autopilot; with `harmless` set (the title backdrop) guards patrol and
  // cameras sweep but nothing is seen, scored or caught.
  function step(dt, input, harmless) {
    let events = 0;
    const p = state.player;
    state.time += dt;
    state.levelTime += dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (state.flash > 0) state.flash -= dt;
    if (state.empT > 0) state.empT -= dt;
    if (state.decoy && (state.decoy.t -= dt) <= 0) state.decoy = null;
    for (const c of state.cameras) {
      if (c.disabled > 0) c.disabled -= dt;
      c.dir = c.base + Math.sin(state.time * c.speed) * c.sweep;
    }

    // --- crew movement
    const running = !!input.run;
    const sneaking = !!input.sneak && !running;
    const speed = sneaking ? 78 : running ? 205 : 135;
    if (input.mx !== 0 || input.my !== 0) {
      const len = Math.hypot(input.mx, input.my);
      const mx = input.mx / len;
      const my = input.my / len;
      p.dir = Math.atan2(my, mx);
      p.moving = true;
      moveCircle(state.map, p, mx * speed * dt, my * speed * dt);
      p.target = null;
      p.path = null;
    } else if (p.path && p.path.length) {
      const node = p.path[0];
      const tx = node.col * TILE + TILE / 2;
      const ty = node.row * TILE + TILE / 2;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) p.path.shift();
      else {
        p.dir = Math.atan2(dy, dx);
        p.moving = true;
        moveCircle(state.map, p, (dx / d) * speed * dt, (dy / d) * speed * dt);
      }
    } else {
      p.moving = false;
    }
    p.running = running;
    p.sneaking = sneaking;

    // Running is loud: guards inside the noise ring come to look.
    if (!harmless && p.moving && running) {
      for (const g of state.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < NOISE_RADIUS && g.state === 'patrol') {
          g.state = 'suspicious';
          g.stateT = 0;
          g.investigate = { x: p.x, y: p.y };
        }
      }
    }

    // --- loot pickups
    if (!harmless) {
      for (const it of state.loot) {
        if (!it.got && Math.hypot(p.x - it.x, p.y - it.y) < 24) {
          it.got = true;
          state.lootGot += 1;
          state.score += LOOT_POINTS;
          events |= EVENT_LOOT;
          setMessage(`${LEVELS[state.levelIndex].lootName} secured ${state.lootGot}/${state.lootTotal}`);
        }
      }
    }

    // --- guards
    let seen = 0;
    let anyChase = false;
    for (const g of state.guards) {
      const vis = guardSees(state.map, g, p.x, p.y);
      if (vis > seen) seen = vis;
      const distP = Math.hypot(p.x - g.x, p.y - g.y);

      if (g.state === 'patrol') {
        const t = g.pts[g.wp];
        const dx = t.x - g.x;
        const dy = t.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) g.wp = (g.wp + 1) % g.pts.length;
        else {
          g.dir = Math.atan2(dy, dx);
          moveCircle(state.map, g, (dx / d) * g.speed * dt, (dy / d) * g.speed * dt);
        }
        if (!harmless && vis > 0.12) {
          g.state = 'suspicious';
          g.stateT = 0;
          g.lastSeen = { x: p.x, y: p.y };
        }
      } else if (g.state === 'suspicious') {
        g.stateT += dt;
        const dest = g.investigate || g.lastSeen;
        if (dest) {
          const dx = dest.x - g.x;
          const dy = dest.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d > 6) {
            g.dir = Math.atan2(dy, dx);
            moveCircle(state.map, g, (dx / d) * g.speed * 1.15 * dt, (dy / d) * g.speed * 1.15 * dt);
          } else {
            // Arrived: look around, then give up and go back to patrol.
            g.dir += dt * 1.6;
            if (g.stateT > 3.2) {
              g.state = 'patrol';
              g.investigate = null;
              g.lastSeen = null;
            }
          }
        }
        if (!harmless && vis > 0.12) {
          g.lastSeen = { x: p.x, y: p.y };
          g.stateT = 0;
        }
        // A guard who keeps seeing the crew at close range gives chase.
        if (!harmless && vis > 0.45 && distP < 130) {
          g.state = 'chase';
          g.chaseT = 0;
        }
      } else if (g.state === 'chase') {
        anyChase = true;
        g.chaseT += dt;
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const d = Math.hypot(dx, dy);
        g.dir = Math.atan2(dy, dx);
        if (d > 2) moveCircle(state.map, g, (dx / d) * g.speed * 1.75 * dt, (dy / d) * g.speed * 1.75 * dt);
        if (!harmless && d < 20) {
          events |= caught();
          return events;
        }
        if (g.chaseT > 4.5) {
          g.state = 'suspicious';
          g.stateT = 0;
          g.lastSeen = { x: p.x, y: p.y };
        }
      }
    }

    // --- cameras: a camera that sees the crew feeds the alarm fast.
    let camSeen = 0;
    for (const c of state.cameras) {
      const vis = cameraSees(state.map, c, p.x, p.y);
      if (vis > camSeen) camSeen = vis;
    }
    if (seen > camSeen) state.seen = seen > 0.12;
    else state.seen = camSeen > 0.1;
    const strongest = Math.max(seen, camSeen);

    // --- alarm meter: only a real sighting feeds it, not a graze at a cone's edge.
    if (!harmless) {
      const pt = playerTile();
      const inDark = isDarkTile(state.map, pt.col, pt.row);
      if (strongest > 0.12) {
        let rate = 26 + strongest * 70 + (camSeen > 0.1 ? 14 : 0);
        if (inDark) rate *= 0.35;
        if (p.running) rate *= 1.6;
        if (p.sneaking) rate *= 0.5;
        state.alarm += rate * dt;
      } else {
        state.alarm -= 12 * dt;
      }
      state.alarm = Math.max(0, Math.min(100, state.alarm));
      if (state.alarm >= 100 && !anyChase) {
        state.alarms += 1;
        state.flash = 0.6;
        events |= EVENT_ALARM;
        setMessage('LOCKDOWN! Every guard is hunting you!');
        for (const g of state.guards) {
          if (guardSees(state.map, g, p.x, p.y) > 0 || Math.hypot(g.x - p.x, g.y - p.y) < 260) {
            g.state = 'chase';
            g.chaseT = 0;
          } else {
            g.state = 'suspicious';
            g.stateT = 0;
            g.lastSeen = { x: p.x, y: p.y };
          }
        }
        state.alarm = 50; // the lockdown spends the meter; hiding again can save you
      }
    }

    // --- exit
    if (!harmless) {
      const exitOpen = state.lootGot === state.lootTotal;
      if (exitOpen && Math.hypot(p.x - state.exit.x, p.y - state.exit.y) < 24) {
        const timeBonus = Math.max(0, 3000 - Math.floor(state.levelTime) * 10);
        const alarmPenalty = state.alarms * 300;
        const gained = 1000 + timeBonus - alarmPenalty;
        state.score += Math.max(200, gained);
        events |= EVENT_LEVEL;
        if (state.levelIndex + 1 < LEVELS.length) {
          state.levelIndex += 1;
          loadLevel(state.levelIndex);
          setMessage(`Job ${state.levelIndex + 1}: ${LEVELS[state.levelIndex].name}`);
        } else {
          events |= EVENT_WIN;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, step, setClickPath, useEmp, useDecoy, findPathSafe, tileDanger, setMessage };
}
