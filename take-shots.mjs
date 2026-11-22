// Takes The Midnight Heist screenshots with the cached headless-shell Chrome:
// serves game/ on localhost:8080 (run `node serve.ts` first), opens each
// scene from shots.json, and saves a PNG to screenshots/<name>. The game's
// ?shot= scenes stage themselves synchronously and set window.__shotReady,
// so a virtual-time budget is enough to let the frame paint.
// Run from the repo root: node take-shots.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SHOTS = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url), 'utf8'));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

for (const shot of SHOTS) {
  execFileSync(CHROME, [
    '--no-sandbox', '--disable-gpu',
    `--window-size=${shot.w},${shot.h}`,
    '--virtual-time-budget=8000',
    `--screenshot=screenshots/${shot.name}`,
    `http://localhost:8080/${shot.query}`,
  ], { stdio: 'ignore' });
  console.log('shot', shot.name, shot.w, 'x', shot.h);
}
console.log('done');
