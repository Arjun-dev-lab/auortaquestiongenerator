import { QuizConfig } from '../types/quiz';

/**
 * Procedural Web Audio API sound engine.
 * 100% offline, zero external audio assets, zero CDN dependencies.
 */

// Helper to calculate question timeline milestones
export function getTimelineEvents(quiz: QuizConfig) {
  const events: {
    type: 'tick' | 'riser' | 'reveal' | 'final';
    time: number;
    questionIndex?: number;
  }[] = [];

  let currentTime = 0;
  quiz.questions.forEach((_q, index) => {
    // Countdown ticks (e.g. for a 3s countdown, ticks at t = 0, 1, 2)
    const count = Math.floor(quiz.countdownDuration);
    for (let i = 0; i < count; i++) {
      events.push({
        type: 'tick',
        time: currentTime + i,
        questionIndex: index,
      });
    }

    // Tension riser during the last 1.2s of countdown
    const riserTime = Math.max(0, currentTime + quiz.countdownDuration - 1.2);
    events.push({
      type: 'riser',
      time: riserTime,
      questionIndex: index,
    });

    // Reveal sound at countdown end
    const revealTime = currentTime + quiz.countdownDuration;
    events.push({
      type: 'reveal',
      time: revealTime,
      questionIndex: index,
    });

    currentTime += quiz.countdownDuration + quiz.revealDuration;
  });

  // Final screen celebratory fanfare
  events.push({
    type: 'final',
    time: currentTime,
  });

  const totalDuration = currentTime + quiz.finalScreenDuration;
  return { events, totalDuration };
}

/**
 * Synthesizes an AudioBuffer containing all SFX and procedural BGM
 * using OfflineAudioContext for video export and audio mixing.
 */
export async function synthesizeQuizAudioBuffer(
  quiz: QuizConfig,
  totalDuration: number,
  sampleRate: number = 44100
): Promise<AudioBuffer | null> {
  if (!quiz.enableBgm && !quiz.enableSfx) {
    return null;
  }

  // Ensure AudioContext/OfflineAudioContext is available
  const OfflineCtxClass =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
      : null;

  if (!OfflineCtxClass) {
    return null;
  }

  const lengthSamples = Math.ceil(totalDuration * sampleRate);
  const offlineCtx = new OfflineCtxClass(2, Math.max(1, lengthSamples), sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);
  masterGain.connect(offlineCtx.destination);

  // 1. Procedural SFX
  if (quiz.enableSfx) {
    const sfxGain = offlineCtx.createGain();
    sfxGain.gain.setValueAtTime(quiz.sfxVolume ?? 0.8, 0);
    sfxGain.connect(masterGain);

    const { events } = getTimelineEvents(quiz);

    events.forEach((ev) => {
      const t = ev.time;
      if (t >= totalDuration) return;

      if (ev.type === 'tick') {
        // High crisp woodblock / countdown tick
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(t);
        osc.stop(t + 0.06);
      } else if (ev.type === 'riser') {
        // Tension pitch riser
        const osc = offlineCtx.createOscillator();
        const filter = offlineCtx.createBiquadFilter();
        const gain = offlineCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 1.1);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(2500, t + 1.1);

        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        osc.start(t);
        osc.stop(t + 1.2);
      } else if (ev.type === 'reveal') {
        // Crystalline correct answer chime (Major 7th / 9th harmonic shimmer)
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = offlineCtx.createOscillator();
          const gain = offlineCtx.createGain();
          const noteTime = t + i * 0.05;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.3, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.6);

          osc.connect(gain);
          gain.connect(sfxGain);

          osc.start(noteTime);
          osc.stop(noteTime + 0.65);
        });
      } else if (ev.type === 'final') {
        // Victory Fanfare arpeggio chord
        const chords = [
          { time: t + 0.0, freqs: [392.0, 523.25, 659.25] }, // G4, C5, E5
          { time: t + 0.2, freqs: [440.0, 587.33, 698.46] }, // A4, D5, F5
          { time: t + 0.4, freqs: [523.25, 659.25, 783.99, 1046.5] }, // C5, E5, G5, C6
        ];

        chords.forEach((chord) => {
          chord.freqs.forEach((freq) => {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, chord.time);

            gain.gain.setValueAtTime(0.22, chord.time);
            gain.gain.exponentialRampToValueAtTime(0.0001, chord.time + 1.2);

            osc.connect(gain);
            gain.connect(sfxGain);

            osc.start(chord.time);
            osc.stop(chord.time + 1.25);
          });
        });
      }
    });
  }

  // 2. Procedural Lo-Fi / Synth Groove BGM
  if (quiz.enableBgm) {
    const bgmGain = offlineCtx.createGain();
    bgmGain.gain.setValueAtTime(quiz.bgmVolume ?? 0.35, 0);
    bgmGain.connect(masterGain);

    // 120 BPM = 0.5s per beat, 4-beat loop = 2.0s
    const beatDuration = 0.5;
    const loopCount = Math.ceil(totalDuration / 2.0);

    const bassNotes = [130.81, 146.83, 164.81, 130.81]; // C3, D3, E3, C3
    const padFrequencies = [
      [261.63, 329.63, 392.0], // C4, E4, G4
      [293.66, 349.23, 440.0], // D4, F4, A4
      [329.63, 392.0, 493.88], // E4, G4, B4
      [261.63, 329.63, 392.0], // C4, E4, G4
    ];

    for (let l = 0; l < loopCount; l++) {
      for (let beat = 0; beat < 4; beat++) {
        const beatTime = l * 2.0 + beat * beatDuration;
        if (beatTime >= totalDuration) break;

        // Bass pulse
        const bassOsc = offlineCtx.createOscillator();
        const bassFilter = offlineCtx.createBiquadFilter();
        const bassG = offlineCtx.createGain();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bassNotes[beat], beatTime);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(250, beatTime);

        bassG.gain.setValueAtTime(0.25, beatTime);
        bassG.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.4);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassG);
        bassG.connect(bgmGain);

        bassOsc.start(beatTime);
        bassOsc.stop(beatTime + 0.45);

        // Gentle warm chord pad
        const chord = padFrequencies[beat];
        chord.forEach((freq) => {
          const padOsc = offlineCtx.createOscillator();
          const padG = offlineCtx.createGain();

          padOsc.type = 'triangle';
          padOsc.frequency.setValueAtTime(freq, beatTime);

          padG.gain.setValueAtTime(0.06, beatTime);
          padG.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.48);

          padOsc.connect(padG);
          padG.connect(bgmGain);

          padOsc.start(beatTime);
          padOsc.stop(beatTime + 0.5);
        });
      }
    }
  }

  // Render the audio buffer
  try {
    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
  } catch (err) {
    console.warn('OfflineAudioContext rendering failed:', err);
    return null;
  }
}

/**
 * Interactive preview audio controller for the in-browser canvas player
 */
class PreviewAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private currentQuiz: QuizConfig | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  getMuted() {
    return this.isMuted;
  }

  playTick() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playReveal() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  playFinal() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.1);
    });
  }
}

export const previewAudio = new PreviewAudioEngine();
