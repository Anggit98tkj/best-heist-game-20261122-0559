// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level clear, game over and win.
//
// ?seed=N fixes the cosmetic dust. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL, EVENT_LOOT, EVENT_OVER, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DECOY,
  ACTION_EMP,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { isMuted, setMuted, sfx } from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const state = world.state;
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      const screenName =
        scene.screen === SCREEN_TITLE ? 'title' : scene.screen === SCREEN_PLAY ? 'play' : scene.screen === SCREEN_OVER ? 'over' : scene.screen === SCREEN_WIN ? 'win' : 'level';
      document.title = `shot:${name} screen:${screenName} level:${state.levelIndex + 1} score:${state.score} lives:${state.lives} loot:${state.lootGot}/${state.lootTotal} alarm:${Math.round(state.alarm)}`;
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  window.__heist = world; // debug hook: lets a play-test read live state

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three jobs. Steal the loot, reach the exit.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Clean getaway! Score ${world.state.score}.` : `Busted. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) {
      sfx('pickup');
      announce(`Loot secured ${world.state.lootGot}/${world.state.lootTotal}.`);
    }
    if (events & EVENT_ALARM) {
      sfx('alarm');
      announce('Lockdown! Every guard is hunting you!');
    }
    if (events & EVENT_CAUGHT) sfx('caught');
    if (events & EVENT_LEVEL) {
      sfx('win');
      if (events & EVENT_WIN) finishRun(true);
      else screen = SCREEN_LEVEL;
    }
    if (events & EVENT_OVER) finishRun(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      setMuted(!isMuted());
      announce(isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_EMP && screen === SCREEN_PLAY) {
      if (world.useEmp()) {
        sfx('emp');
        announce('EMP burst! Cameras down for 6 seconds.');
      }
    }
    if (actions & ACTION_DECOY && screen === SCREEN_PLAY) {
      if (world.useDecoy()) {
        sfx('decoy');
        announce('Decoy tossed. A guard goes to look.');
      }
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_RESTART && screen === SCREEN_PLAY) {
      // Restart the current job (score and lives stay; the room resets).
      world.loadLevel(world.state.levelIndex);
      announce(`Job ${world.state.levelIndex + 1} restarted.`);
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVEL) screen = SCREEN_PLAY;
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      else if (screen === SCREEN_PLAY && click) world.setClickPath(click.x, click.y);
    } else if (click && screen === SCREEN_PLAY) {
      world.setClickPath(click.x, click.y);
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, run: false, sneak: false }, true);
      return;
    }
    const events = world.step(STEP, input.direction(), false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Midnight Heist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
