// Audio + Haptics settings
// Stored in localStorage under 'mdeal-audio-setting'
// Values: 'both' | 'haptics' | 'none'
export type AudioSetting = 'both' | 'haptics' | 'none';
const AUDIO_KEY = 'mdeal-audio-setting';

export function getAudioSetting(): AudioSetting {
  return (localStorage.getItem(AUDIO_KEY) as AudioSetting) ?? 'both';
}
export function setAudioSetting(s: AudioSetting) {
  localStorage.setItem(AUDIO_KEY, s);
}
function soundEnabled() { return getAudioSetting() === 'both'; }
function hapticsEnabled() { const s = getAudioSetting(); return s === 'both' || s === 'haptics'; }

/** Trigger device vibration (Android; silently no-ops on iOS/unsupported). */
export function vibrate(pattern: number | number[]) {
  if (!hapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

// Web Audio API sound effects — no external files, works on iOS PWA
//
// iOS RULES:
//  1. AudioContext must be created inside a user-gesture handler
//  2. A real buffer must be played during that same gesture to fully unlock
//  3. After unlock, sounds can fire at any time
//
// We attach unlock to touchstart, touchend, click, mousedown, keydown so the
// very first interaction (e.g. the "Create Room" button) unlocks audio.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AudioCtx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;

let _ctx: AudioContext | null = null;
let _unlocked = false;

function unlock() {
  if (_unlocked || typeof window === 'undefined') return;
  try {
    _ctx = _ctx ?? new AudioCtx();
    // Play a 1-sample silent buffer — this is what actually unlocks iOS audio
    const buf = _ctx.createBuffer(1, 1, 22050);
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    src.connect(_ctx.destination);
    src.start(0);
    _ctx.resume().then(() => { _unlocked = true; }).catch(() => { _unlocked = true; });
    _unlocked = true;
  } catch { /* ignore */ }
}

// Attach to every plausible first-interaction event
if (typeof document !== 'undefined') {
  (['touchstart', 'touchend', 'click', 'mousedown', 'keydown'] as const).forEach(evt => {
    document.addEventListener(evt, unlock, { once: true, passive: true });
  });
}

function getCtx(): AudioContext | null {
  if (!_ctx) return null;
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.35, delay = 0): void {
  if (!soundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch { /* ignore audio errors */ }
}

export const sounds = {
  /** Short pop when you play a card */
  cardPlayed:  () => tone(700, 0.08, 'square', 0.20),
  /** Softer click for banking cash */
  bankCard:    () => tone(450, 0.10, 'sine', 0.18),
  /** Ascending chime — your turn starts */
  yourTurn:    () => {
    tone(523, 0.15, 'sine', 0.35);
    tone(659, 0.15, 'sine', 0.35, 0.16);
    tone(784, 0.25, 'sine', 0.35, 0.33);
  },
  /** Single tick for timer countdown ≤10 s */
  timerTick:   () => tone(880, 0.05, 'square', 0.15),
  /** Faster double-tick for timer ≤5 s */
  timerUrgent: () => {
    tone(1100, 0.07, 'square', 0.28);
    tone(1100, 0.07, 'square', 0.28, 0.12);
  },
  /** Low buzz — Just Say No played / cancelled */
  jsnPlayed:   () => {
    tone(220, 0.25, 'sawtooth', 0.28);
    tone(160, 0.25, 'sawtooth', 0.22, 0.16);
  },
  /** Descending alert — payment is due */
  paymentDue:  () => {
    tone(440, 0.14, 'sine', 0.30);
    tone(330, 0.25, 'sine', 0.28, 0.16);
  },
  /** Drop — a card was stolen from you */
  cardTaken:   () => {
    tone(400, 0.12, 'sine', 0.25);
    tone(230, 0.28, 'sine', 0.25, 0.13);
  },
  /** Victory fanfare */
  winner: () =>
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'sine', 0.40, i * 0.14)),
  /** Defeat sound */
  gameOver: () =>
    [330, 270, 210].forEach((f, i) => tone(f, 0.35, 'sine', 0.32, i * 0.24)),
};
