// Every pixel of the game: the building, the crew, the guards and their vision
// cones, the cameras and their sweeping red cones, the loot, the exit, and the
// HUD with its alarm meter. All art is drawn procedurally on canvas.
import { CAMERA_HALF, CAMERA_RANGE, COLS, CONE_HALF, CONE_RANGE, H, LEVELS, ROWS, TILE, W } from './config.js';
import { isSolidTile, rayLength } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;
export const SCREEN_LEVEL = 5;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(state, screen, best) {
    const scale = Math.min(canvas.width / W, canvas.height / H);
    const ox = (canvas.width - W * scale) / 2;
    const oy = (canvas.height - H * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    drawFloor(state);
    drawLoot(state);
    drawExit(state);
    drawCameras(state);
    drawGuards(state);
    drawPlayer(state);
    drawDust(state);
    drawHud(state);
    drawToolBar(state);
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_PAUSED) drawOverlay('PAUSED', 'Press P or click to keep the job going.');
    else if (screen === SCREEN_OVER) drawOverlay('BUSTED!', `The crew got caught.\nScore ${state.score}   Best ${best}\nPress R or click to try again.`);
    else if (screen === SCREEN_WIN) drawOverlay('CLEAN GETAWAY!', `Every job done, every vault emptied.\nScore ${state.score}   Best ${best}\nPress R or click to play again.`);
    else if (screen === SCREEN_LEVEL) drawOverlay(`JOB ${state.levelIndex + 1}`, `${LEVELS[state.levelIndex].name}\nSteal all the ${LEVELS[state.levelIndex].lootName}, then reach the EXIT.\nPress Space or click to continue.`);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(220,40,40,${Math.min(0.35, state.flash * 0.4)})`;
      ctx.fillRect(0, 0, W, H);
      state.flash = Math.max(0, state.flash - 0.02); // fades even on the end screens
    }
  }

  function drawFloor(state) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const t = state.map[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (t === '#') {
          ctx.fillStyle = '#453a58';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#5d4c78';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#332a44';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#241c33' : '#201828';
          ctx.fillRect(x, y, TILE, TILE);
          if (t === 'D') {
            ctx.fillStyle = 'rgba(88,60,160,0.30)';
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = 'rgba(150,120,255,0.5)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DARK', x + TILE / 2, y + TILE / 2 + 3);
          }
        }
        if (t === 'C') {
          ctx.fillStyle = '#6b4a26';
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.strokeStyle = '#3d2a14';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + TILE - 4, y + TILE - 4);
          ctx.moveTo(x + TILE - 4, y + 4);
          ctx.lineTo(x + 4, y + TILE - 4);
          ctx.stroke();
        }
      }
    }
  }

  // The loot looks like the job: framed paintings, gold bars, diamonds.
  function drawLoot(state) {
    for (const it of state.loot) {
      if (it.got) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.time * 4 + it.col);
      ctx.save();
      ctx.translate(it.x, it.y);
      if (state.levelIndex === 0) {
        ctx.fillStyle = `rgba(212,175,55,${0.85 * pulse})`;
        ctx.fillRect(-13, -10, 26, 20);
        ctx.fillStyle = '#7a2f2f';
        ctx.fillRect(-9, -6, 18, 12);
        ctx.fillStyle = '#e8c96a';
        ctx.fillRect(-4, -3, 8, 6);
      } else if (state.levelIndex === 1) {
        ctx.fillStyle = `rgba(255,205,60,${0.85 * pulse})`;
        ctx.fillRect(-12, -7, 24, 14);
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(-12, -2, 24, 3);
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(-8, -5, 16, 3);
      } else {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = `rgba(120,230,255,${0.85 * pulse})`;
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(-4, -4, 8, 8);
      }
      ctx.restore();
    }
  }

  function drawExit(state) {
    const e = state.exit;
    const open = state.lootGot === state.lootTotal;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = open ? '#1fbf5b' : '#3a4a3a';
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeStyle = open ? '#a9f5c6' : '#5a6a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.fillStyle = '#eafff0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : 'LOCK', 0, 4);
    if (!open) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#cfe8d4';
      ctx.fillText(`${state.lootGot}/${state.lootTotal} loot`, 0, 30);
    }
    ctx.restore();
  }

  function drawCameras(state) {
    for (const c of state.cameras) {
      const disabled = c.disabled > 0;
      // Sweeping red cone, raycast so walls cut it off.
      const rays = 20;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      for (let i = 0; i <= rays; i += 1) {
        const a = c.dir - CAMERA_HALF + (2 * CAMERA_HALF * i) / rays;
        const len = rayLength(state.map, c.x, c.y, a, CAMERA_RANGE);
        ctx.lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
      }
      ctx.closePath();
      ctx.fillStyle = disabled ? 'rgba(120,120,120,0.10)' : 'rgba(255,60,60,0.32)';
      ctx.fill();
      // The camera dome on its wall mount.
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = disabled ? '#555' : '#a02020';
      ctx.fill();
      ctx.strokeStyle = disabled ? '#888' : '#ff7070';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = disabled ? '#777' : '#ff4040';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(c.dir) * 15, c.y + Math.sin(c.dir) * 15);
      ctx.strokeStyle = disabled ? '#999' : '#ff9090';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (disabled) {
        ctx.fillStyle = '#ddd';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OFF', c.x, c.y - 14);
      }
    }
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      // Vision cone, raycast so walls and crates cut it off.
      const alerted = g.state === 'chase';
      const suspicious = g.state === 'suspicious';
      const rays = 26;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      for (let i = 0; i <= rays; i += 1) {
        const a = g.dir - CONE_HALF + (2 * CONE_HALF * i) / rays;
        const len = rayLength(state.map, g.x, g.y, a, CONE_RANGE);
        ctx.lineTo(g.x + Math.cos(a) * len, g.y + Math.sin(a) * len);
      }
      ctx.closePath();
      ctx.fillStyle = alerted ? 'rgba(255,60,50,0.44)' : suspicious ? 'rgba(255,170,40,0.36)' : 'rgba(255,230,90,0.30)';
      ctx.fill();
      // Guard body: a night watchman with a torch.
      ctx.beginPath();
      ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = alerted ? '#d92b1f' : suspicious ? '#d97a1f' : '#31418f';
      ctx.fill();
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.dir) * 18, g.y + Math.sin(g.dir) * 18);
      ctx.strokeStyle = '#ffe9b0';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (alerted || suspicious) {
        ctx.fillStyle = alerted ? '#ff5040' : '#ffb020';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(alerted ? '!' : '?', g.x, g.y - 20);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    // Noise ring while running.
    if (p.moving && p.running) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 110, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,120,80,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (p.target && p.path && p.path.length) {
      ctx.beginPath();
      ctx.arc(p.target.x, p.target.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(140,220,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (state.decoy) {
      ctx.beginPath();
      ctx.arc(state.decoy.x, state.decoy.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe27a';
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.sneaking ? '#2f7fb8' : '#35c08a';
    ctx.fill();
    ctx.strokeStyle = '#eafff5';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood point shows facing.
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.dir) * 8, p.y + Math.sin(p.dir) * 8);
    ctx.lineTo(p.x + Math.cos(p.dir + 2.5) * 12, p.y + Math.sin(p.dir + 2.5) * 12);
    ctx.lineTo(p.x + Math.cos(p.dir - 2.5) * 12, p.y + Math.sin(p.dir - 2.5) * 12);
    ctx.closePath();
    ctx.fillStyle = '#0e2a1e';
    ctx.fill();
  }

  function drawDust(state) {
    ctx.fillStyle = 'rgba(200,220,255,0.16)';
    for (const d of state.dust) {
      ctx.fillRect(d.x + Math.sin(state.time * 0.4 + d.p) * 3, d.y, d.s, d.s);
    }
  }

  function drawHud(state) {
    ctx.fillStyle = 'rgba(5,8,15,0.82)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#e8eefc';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`JOB ${state.levelIndex + 1}  ${LEVELS[state.levelIndex].name}`, 10, 22);
    ctx.fillText(`SCORE ${state.score}`, 330, 22);
    ctx.fillText(`LOOT ${state.lootGot}/${state.lootTotal}`, 450, 22);
    ctx.fillText(`TIME ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, 560, 22);
    ctx.fillStyle = '#ff6b7a';
    ctx.fillText('♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, 3 - state.lives)), 640, 22);
    // The alarm meter: the number the whole job hangs on.
    const bx = 720;
    const by = 10;
    const bw = 130;
    const bh = 14;
    ctx.fillStyle = '#e8eefc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ALARM', bx - 52, by + 11);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(bx, by, bw, bh);
    const al = state.alarm / 100;
    ctx.fillStyle = al < 0.5 ? '#e8c33a' : al < 0.8 ? '#ff8c1a' : '#ff2e1f';
    ctx.fillRect(bx, by, bw * al, bh);
    ctx.strokeStyle = '#8b93a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.seen ? 'SEEN!' : 'HIDDEN', bx + bw / 2, by + 11);
    ctx.textAlign = 'left';
    if (state.messageT > 0) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, W / 2, 58);
    }
    ctx.textAlign = 'left';
  }

  function drawToolBar(state) {
    ctx.fillStyle = 'rgba(5,8,15,0.82)';
    ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = '#c8d2e8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const emp = state.empT > 0 ? `EMP DOWN ${Math.ceil(state.empT)}s` : `F EMP x${state.empCharges} (-150)`;
    ctx.fillText(emp, 10, H - 8);
    ctx.fillText(`G DECOY x${state.decoyCharges} (-100)`, 210, H - 8);
    ctx.fillText('WASD move   SHIFT run (loud)   C sneak   Click walk there   P pause   M mute', 430, H - 8);
  }

  function drawOverlay(title, body) {
    ctx.fillStyle = 'rgba(4,6,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2f6ff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 60);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#c8d2e8';
    const lines = body.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 10 + i * 26));
    ctx.textAlign = 'left';
  }

  function drawTitle(state) {
    drawOverlay(
      'THE MIDNIGHT HEIST',
      'Three jobs. One crew. No alarms.\nSteal all the loot, then reach the EXIT.\n\nWASD / arrows - move    SHIFT - run (fast, loud, visible)\nC - sneak (slow, quiet)    Click - walk there    P - pause    M - mute\nR - restart this job    F - EMP burst, cameras down 6s (-150)\nG - decoy coin (-100)\n\nYellow cones are guard sight, red cones are cameras.\nWalls and crates block them. Darkness slows the alarm.\nA full ALARM meter means lockdown: every guard hunts you.\n\nPress Space or click to start the first job.',
    );
  }

  return { draw };
}
