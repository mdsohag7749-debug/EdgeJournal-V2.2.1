let sharedAudioContext = null;

function prepareToneSequence({ frequencies, type, gain: peakGain, noteDuration, gap }) {
  if (typeof window === 'undefined') return () => {};

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return () => {};

  try {
    sharedAudioContext ||= new AudioContextClass();
    const context = sharedAudioContext;
    const ready = context.state === 'suspended' ? context.resume().catch(() => {}) : Promise.resolve();

    return () => {
      ready.then(() => {
        if (context.state !== 'running') return;
        const startAt = context.currentTime;
        frequencies.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = startAt + index * gap;
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + noteDuration + 0.01);
        });
      }).catch(() => {});
    };
  } catch {
    return () => {};
  }
}

// Prepare during a user gesture so browsers allow playback after async work.
export function prepareSuccessSound() {
  return prepareToneSequence({
    frequencies: [659.25, 880],
    type: 'sine',
    gain: 0.055,
    noteDuration: 0.2,
    gap: 0.095,
  });
}

// A lower, descending alert distinguishes validation and failed actions.
export function prepareErrorSound() {
  return prepareToneSequence({
    frequencies: [440, 329.63],
    type: 'triangle',
    gain: 0.045,
    noteDuration: 0.16,
    gap: 0.105,
  });
}
