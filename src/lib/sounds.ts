// Web Audio API Sound Synthesizer for high-fidelity low-poly game sounds
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(state?: boolean) {
    this.enabled = state !== undefined ? state : !this.enabled;
  }

  getIsEnabled() {
    return this.enabled;
  }

  // Shoot Sound Generator
  playShoot(type: string) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // We make a noise buffer for explosive gunfire sounds
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to shape the gunshot sound (lowpass / bandpass)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    // Tone oscillator to give the weapon its punch
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    switch (type) {
      case 'SNIPER':
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(10, now + 0.35);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.25);
        oscGain.gain.setValueAtTime(0.8, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        break;
      case 'LMG':
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.12);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.1);
        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        break;
      case 'SMG':
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        oscGain.gain.setValueAtTime(0.2, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        break;
      case 'SHOTGUN':
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
        oscGain.gain.setValueAtTime(0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        break;
      case 'PISTOL':
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        break;
      case 'KNIFE':
        // A swoosh sound
        const swooshOsc = ctx.createOscillator();
        const swooshGain = ctx.createGain();
        swooshOsc.type = 'sine';
        swooshOsc.frequency.setValueAtTime(600, now);
        swooshOsc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        swooshGain.gain.setValueAtTime(0.3, now);
        swooshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        swooshOsc.connect(swooshGain);
        swooshGain.connect(ctx.destination);
        swooshOsc.start(now);
        swooshOsc.stop(now + 0.16);
        return;
      default: // AR
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    }

    const noiseGain = ctx.createGain();
    const duration = type === 'SNIPER' ? 0.35 : type === 'SHOTGUN' ? 0.25 : type === 'LMG' ? 0.12 : type === 'SMG' ? 0.08 : 0.15;
    noiseGain.gain.setValueAtTime(type === 'SNIPER' ? 0.8 : type === 'SHOTGUN' ? 0.9 : 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }

  // Hitmarker sound
  playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now); // short, sharp high blip
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Heavy Headshot Hitmarker sound
  playHeadshot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(2800, now);
    osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3200, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now);
    osc2.stop(now + 0.12);
  }

  // Kill confirm sound (satisfying sound)
  playKill() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Play a satisfying punchy chord
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator(); // Add bass punch
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1320, now + 0.08); // E6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1109, now); // C#6
    osc2.frequency.setValueAtTime(1760, now + 0.08); // A6

    osc3.type = 'square';
    osc3.frequency.setValueAtTime(100, now);
    osc3.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now);
    osc2.stop(now + 0.35);
    osc3.start(now);
    osc3.stop(now + 0.2);
  }

  // Take damage sound (hurt)
  playHurt() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Player death sound
  playDeath() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Reload click-clack sound
  playReload() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // First click: remove mag
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(400, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.06);

    // Second click: slide pull (350ms later)
    setTimeout(() => {
      if (!ctx || ctx.state === 'closed') return;
      const tNow = ctx.currentTime;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(800, tNow);
      osc2.frequency.setValueAtTime(500, tNow + 0.04);
      gain2.gain.setValueAtTime(0.15, tNow);
      gain2.gain.exponentialRampToValueAtTime(0.01, tNow + 0.08);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(tNow);
      osc2.stop(tNow + 0.1);
    }, 350);
  }

  // Ability activation sound
  playAbility() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Defeat/victory chime
  playMatchEnd(isVictory: boolean) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const notes = isVictory ? [261.63, 329.63, 392.00, 523.25] : [261.63, 246.94, 220.00, 196.00]; // Major vs Minor
    const duration = 0.35;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.2, now + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (idx + 1) * 0.2 + duration);
    });
  }
}

export const sounds = new SoundManager();
export default sounds;
