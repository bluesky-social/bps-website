import { useEffect } from 'react';

/**

 *
 * To regenerate the asset (start time / window are the only knobs that need
 * the source file):
 *   ffmpeg -ss 13.5 -t 80 -i Jet.webm -ac 2 -ar 44100 -b:a 128k \
 *     -codec:a libmp3lame static/jet.mp3
 */

// --- tunables ---------------------------------------------------------------
const AUDIO_URL = '/jet.mp3';
const STEP_PX = 28;     // scroll distance that advances one "word"
const SLICE_MS = 320;   // how much audio each step plays (~one word/syllable)
const FADE_MS = 12;     // tiny fade to avoid clicks at slice edges
// ----------------------------------------------------------------------------

export default function JetEasterEgg() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ctx;
    let buffer = null;
    let sliceCount = 0;
    let lastIndex = -1;
    let current = null; // currently playing { source, gain }
    let disposed = false;

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ensureBuffer = async () => {
      if (buffer || !ctx) return;
      try {
        const res = await fetch(AUDIO_URL);
        const data = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(data);
        sliceCount = Math.max(1, Math.floor(buffer.duration / (SLICE_MS / 1000)));
        // eslint-disable-next-line no-console
        console.log('%cJet 🛬', 'font-weight:bold', 'scroll at exactly the right pace…');
      } catch (e) {
        /* easter egg; fail silently */
      }
    };

    const stopCurrent = () => {
      if (!current) return;
      const { source, gain } = current;
      const t = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(0, t, FADE_MS / 1000);
        source.stop(t + FADE_MS / 1000 + 0.02);
      } catch (e) {
        /* already stopped */
      }
      current = null;
    };

    const playSlice = (index) => {
      if (!buffer || !ctx) return;
      const sliceSec = SLICE_MS / 1000;
      const offset = (index % sliceCount) * sliceSec;

      stopCurrent();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      const fade = FADE_MS / 1000;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + fade);
      gain.gain.setValueAtTime(1, t + sliceSec - fade);
      gain.gain.linearRampToValueAtTime(0, t + sliceSec);

      source.connect(gain).connect(ctx.destination);
      source.start(t, offset, sliceSec);
      current = { source, gain };
    };

    const onScroll = () => {
      if (disposed) return;
      if (!ctx) ctx = new AudioCtor();
      if (ctx.state === 'suspended') ctx.resume();
      if (!buffer) {
        ensureBuffer();
        return; // nothing to play until decoded
      }
      const index = Math.floor(window.scrollY / STEP_PX);
      if (index < 0 || index === lastIndex) return;
      lastIndex = index;
      playSlice(index);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      disposed = true;
      window.removeEventListener('scroll', onScroll);
      stopCurrent();
      if (ctx) ctx.close();
    };
  }, []);

  return null;
}
