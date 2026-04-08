// Web Audio API sound effects — no external files, works on iOS PWA after first user gesture

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// Unlock on first touch/click — required for iOS PWA
if (typeof document !== 'undefined') {
  const unlock = () => ctx();
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('click', unlock, { once: true });
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.22, delay = 0): void {
  const c = ctx();
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
  /** Short click when a card is played */
  cardPlayed:  () => tone(600, 0.07, 'square', 0.12),
  /** Softer click for banking cash */
  bankCard:    () => tone(420, 0.09, 'sine', 0.12),
  /** Ascending chime — your turn starts */
  yourTurn:    () => {
    tone(523, 0.13);
    tone(659, 0.13, 'sine', 0.22, 0.14);
    tone(784, 0.20, 'sine', 0.22, 0.29);
  },
  /** Single tick for timer countdown (≤10 s) */
  timerTick:   () => tone(880, 0.04, 'square', 0.08),
  /** Faster double-tick for timer ≤5 s */
  timerUrgent: () => { tone(1100, 0.06, 'square', 0.18); tone(1100, 0.06, 'square', 0.18, 0.1); },
  /** Low buzz — Just Say No played */
  jsnPlayed:   () => { tone(220, 0.22, 'sawtooth', 0.18); tone(160, 0.22, 'sawtooth', 0.15, 0.14); },
  /** Descending alert — payment is due */
  paymentDue:  () => { tone(350, 0.12, 'sine', 0.18); tone(270, 0.22, 'sine', 0.18, 0.14); },
  /** Drop — a card was stolen from you */
  cardTaken:   () => { tone(330, 0.10, 'sine', 0.15); tone(200, 0.22, 'sine', 0.15, 0.11); },
  /** Victory fanfare */
  winner:      () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'sine', 0.28, i * 0.13)),
  /** Defeat sound */
  gameOver:    () => [330, 270, 210].forEach((f, i) => tone(f, 0.30, 'sine', 0.22, i * 0.22)),
};
