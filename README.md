# The Midnight Heist

A top-down heist game that runs offline in a desktop browser from static
files. You are Wren, the crew's infiltrator. Three jobs: a gallery, a bank,
and a casino vault. Steal every piece of loot, then slip out through the
exit before the alarm fills.

## The game

Three hand-built jobs, each harder than the last: more guards, faster
patrols, more cameras, tighter rooms.

- **Patrolling guards with vision cones.** A guard's cone is raycast, so
  walls and crates genuinely cut it off. Step behind a crate and the cone
  stops at the crate. A guard who glimpses you turns suspicious and comes
  to look; keep being seen up close and he gives chase.
- **Sweeping security cameras.** Red cones sweep the halls on their own
  rhythm and feed the alarm faster than a guard's eyes. An EMP burst
  (F) kills every camera for 6 seconds, at a price.
- **The alarm meter.** It fills while any guard or camera sees you
  (faster up close, in the light, or while running) and drains while you
  hide. A full meter means lockdown: every guard hunts you.
- **Darkness and cover.** Crates block sight. Dark zones slow the alarm
  to a crawl, so crossing a lit hall is a risk and the shadows are the
  safe route.
- **Tools at a cost.** EMP bursts (-150 score, 2 per job) and decoy coins
  (-100 score, 2 per job) that pull the nearest guard away to investigate.
  Spend them when the plan needs them, not before.
- **Noise and speed.** Walk quiet, sneak slower and quieter still, or run:
  fast, but loud enough for nearby guards to hear and easy to spot. A
  running noise ring shows how far your footsteps carry.
- **Objective and score.** Every job hides three pieces of loot; the exit
  stays locked until they are all stolen. Score comes from loot, a time
  bonus, and a penalty for every lockdown. Getting caught costs a life;
  three strikes and the crew is busted.
- **Screens and controls.** Title, pause, job-clear, win, and game-over
  screens. WASD or arrows to move, Shift to run, C to sneak, click to
  walk to a spot, F for EMP, G for a decoy, P to pause, M to mute, R to
  restart the job. Web Audio sound effects: pickup chimes, alarm stings, EMP
  zaps, and a win jingle. No network requests, no external assets, no
  libraries; all art is drawn procedurally on canvas.

## How to play

1. Open `game/index.html` in a desktop browser, or serve the folder:
   `node serve.ts` and open http://localhost:8080
2. Press Space or click to start.
3. Steal all three pieces of loot (glowing gold), then reach the green
   EXIT. Stay out of the yellow guard cones and the red camera cones,
   use crates and darkness, and do not run past a guard unless you are
   sure he is looking the other way.

## How to run the entry

```sh
node serve.ts        # play at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the dossier
```

Screenshots are staged from the real game with `?shot=start|play|end&seed=1`,
which plays the job forward with a built-in autopilot and paints the
resulting frame, so every screenshot is a genuine render of the game code.

Play-tested in desktop Chrome with the keyboard and with the autopilot:
movement, the alarm meter climbing when spotted, the meter draining while
hidden in darkness, the lockdown chase and catch, the exit advancing to
the next job, EMP blackouts, decoy lures, pause/resume, and the win and
game-over screens. The careful autopilot clears all three jobs in one run
with all three lives (score 15,230), so the game is winnable; the reckless
autopilot is caught three times and reaches the game-over screen, so it is
also losable.
