// All sound is synthesized with Web Audio: no audio files, no network.
// Each effect is a couple of short oscillator beeps; audio never breaks play.
let audioCtx = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function beep(freq, dur, type, vol, when) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Browsers start audio suspended until a gesture: resume on first use
    // so the first pickup after loading is heard, not swallowed.
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const t = audioCtx.currentTime + (when || 0);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    // Audio is a bonus; never break the game.
  }
}

export function sfx(name) {
  if (name === 'pickup') {
    beep(880, 0.09, 'sine', 0.09);
    beep(1318, 0.14, 'sine', 0.07, 0.08);
  } else if (name === 'alarm') {
    beep(220, 0.18, 'square', 0.07);
    beep(175, 0.22, 'square', 0.07, 0.16);
  } else if (name === 'caught') {
    beep(160, 0.3, 'sawtooth', 0.09);
    beep(90, 0.45, 'sawtooth', 0.09, 0.2);
  } else if (name === 'win') {
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.16, 'sine', 0.08, i * 0.11));
  } else if (name === 'emp') {
    beep(1200, 0.12, 'square', 0.06);
    beep(300, 0.25, 'sawtooth', 0.06, 0.1);
  } else if (name === 'decoy') {
    beep(1568, 0.06, 'triangle', 0.08);
    beep(1568, 0.06, 'triangle', 0.06, 0.18);
  } else if (name === 'step') {
    beep(140, 0.04, 'triangle', 0.02);
  }
}
