// Synthesized sound only: no audio files, no network. An engine hum that follows speed,
// a two-tone police siren, and short blips for pickups, punches and mission events. The
// context is created on the first user gesture, so it never blocks the page from loading.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); },
    /** M toggles sound: the master gain goes to zero and back. */
    toggleMute() {
      muted = !muted;
      if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() { return muted; },
    /** speed01: 0..1 of the car's top speed; driving false cuts the engine. */
    engine(speed01, driving) {
      if (!ensure()) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, ctx.currentTime, 0.1);
      engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, ctx.currentTime, 0.1);
    },
    siren(on) {
      sirenOn = on;
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    /** Call every frame while the siren is on: flips the tone twice a second. */
    updateSiren(dt) {
      if (!sirenOn || !ctx) return;
      sirenPhase += dt;
      if (sirenPhase > 0.5) {
        sirenPhase = 0;
        sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 800 ? 700 : 950, ctx.currentTime, 0.02);
      }
    },
    cash() { blip(880, 0.12, 'sine', 0.22); setTimeout(() => blip(1318, 0.16, 'sine', 0.2), 90); },
    punch() { blip(160, 0.1, 'square', 0.25, 70); },
    enter() { blip(300, 0.08, 'triangle', 0.18, 420); },
    mission() { blip(523, 0.12, 'sine', 0.2); setTimeout(() => blip(659, 0.12, 'sine', 0.2), 110); setTimeout(() => blip(784, 0.22, 'sine', 0.22), 220); },
    /** A single crate collected in Harbor Lights: a short rising two-note tick. */
    stinger() { blip(659, 0.1, 'sine', 0.2); setTimeout(() => blip(988, 0.18, 'sine', 0.2), 90); },
    /** The biggest job pays out: a four-note fanfare over the mission jingle. */
    fanfare() { this.mission(); setTimeout(() => blip(1046, 0.3, 'sine', 0.22), 340); setTimeout(() => blip(1318, 0.4, 'sine', 0.22), 480); },
    /** The harbour horn when Harbor Lights starts: two low foghorn notes. */
    horn() { blip(147, 0.7, 'sawtooth', 0.16, 138); setTimeout(() => blip(147, 0.7, 'sawtooth', 0.16, 138), 800); },
    fail() { blip(320, 0.25, 'sawtooth', 0.18, 140); },
    bust() { blip(220, 0.4, 'sawtooth', 0.2, 90); },
  };
}
