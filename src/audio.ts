/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundManager {
  // Real-time audio debugging states (HUD display matched)
  public currentBgm: string = 'None';
  public currentAmbient: string = 'None';
  public currentSfx: string = 'None';

  // Web Audio Context & Nodes
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  // Local configurations
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;

  // Music sequencer settings
  private sequencerTimer: any = null;
  private seqStep: number = 0;
  private bpm: number = 120;
  private isSeqRunning: boolean = false;
  private activeTheme: 'FARM' | 'FACTORY' | 'CHAMPION' = 'FARM';
  private currentBgmTitle: string = 'None';

  // Local volume adjustments
  private masterVol: number = 0.55;
  private sfxVol: number = 0.70;
  private bgmVol: number = 0.50;

  // Combo pitches
  private lastCollectTime: number = 0;
  private collectCombo: number = 0;

  constructor() {
    // Volume configs are loaded early. Context is initialized on first user click.
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      this.masterVol = parseFloat(localStorage.getItem('skm_vol_master') ?? '0.55');
      this.sfxVol = parseFloat(localStorage.getItem('skm_vol_sfx') ?? '0.70');
      this.bgmVol = parseFloat(localStorage.getItem('skm_vol_bgm') ?? '0.50');
      this.soundEnabled = localStorage.getItem('skm_sound_enabled') !== 'false';
      this.musicEnabled = localStorage.getItem('skm_music_enabled') !== 'false';
    } catch (e) {
      console.warn("Audio storage read failed, using defaults.", e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('skm_vol_master', this.masterVol.toString());
      localStorage.setItem('skm_vol_sfx', this.sfxVol.toString());
      localStorage.setItem('skm_vol_bgm', this.bgmVol.toString());
      localStorage.setItem('skm_sound_enabled', this.soundEnabled ? 'true' : 'false');
      localStorage.setItem('skm_music_enabled', this.musicEnabled ? 'true' : 'false');
    } catch (e) {}
  }

  private ensureContext() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      this.ctx = new AudioCtxClass();
      
      // Setup master graph
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVol, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVol : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVol : 0, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      // Start looping procedural music
      if (this.musicEnabled) {
        this.startBgmSequencer();
      }
    } catch (err) {
      console.error("Web Audio Context creation error:", err);
    }
  }

  public setConfig(sound: boolean, music: boolean) {
    this.soundEnabled = sound;
    this.musicEnabled = music;
    this.saveToStorage();

    if (this.ctx) {
      if (this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVol : 0, this.ctx.currentTime);
      }
      if (this.bgmGain) {
        this.bgmGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVol : 0, this.ctx.currentTime);
      }
      if (this.musicEnabled) {
        this.startBgmSequencer();
      } else {
        this.stopBgmSequencer();
      }
    }
  }

  // --- Volume Getters & Setters ---
  public getMasterVolume(): number { return this.masterVol; }
  public getSfxVolume(): number { return this.sfxVol; }
  public getBgmVolume(): number { return this.bgmVol; }

  public setMasterVolume(val: number) {
    this.masterVol = val;
    this.saveToStorage();
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVol = val;
    this.saveToStorage();
    if (this.ctx && this.sfxGain && this.soundEnabled) {
      this.sfxGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  public setBgmVolume(val: number) {
    this.bgmVol = val;
    this.saveToStorage();
    if (this.ctx && this.bgmGain && this.musicEnabled) {
      this.bgmGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  public update(speed: number, distance: number, theme?: string) {
    // Dynamic transition of tempo based on velocity
    if (theme === 'FACTORY' && this.activeTheme !== 'FACTORY') {
      this.activeTheme = 'FACTORY';
      this.bpm = 138;
    } else if (theme === 'CHAMPION' && this.activeTheme !== 'CHAMPION') {
      this.activeTheme = 'CHAMPION';
      this.bpm = 150;
    } else if ((!theme || theme === 'FARM') && this.activeTheme !== 'FARM') {
      this.activeTheme = 'FARM';
      this.bpm = 120;
    }
  }

  // Sequencer Engine: Loops a 16-step simple drum and synthesizer track
  private startBgmSequencer() {
    this.ensureContext();
    if (this.isSeqRunning || !this.ctx) return;
    this.isSeqRunning = true;
    this.seqStep = 0;

    const stepIntervalMs = (60 / this.bpm) / 4 * 1000; // Sixteenth note time in ms
    this.sequencerTimer = setInterval(() => {
      this.playSequencerStep();
    }, stepIntervalMs);

    this.currentBgm = `Arcade ${this.activeTheme} Theme (${this.bpm} BPM)`;
  }

  private stopBgmSequencer() {
    if (this.sequencerTimer) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    this.isSeqRunning = false;
    this.currentBgm = 'None';
  }

  private playSequencerStep() {
    if (!this.ctx || !this.bgmGain || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const step = this.seqStep;
    
    // 1. Synth Bass Note (Triangle oscillation for warm retro bass)
    // Scale patterns: simple bouncing arpeggios
    let bassFreq = 110; // A2
    if (this.activeTheme === 'FARM') {
      const notes = [130.81, 146.83, 164.81, 196.00]; // C3, D3, E3, G3
      bassFreq = notes[Math.floor(step / 4) % notes.length];
    } else if (this.activeTheme === 'FACTORY') {
      const notes = [110.00, 116.54, 130.81, 146.83]; // A2, A#2, C3, D3
      bassFreq = notes[Math.floor(step / 4) % notes.length];
    } else {
      const notes = [146.83, 164.81, 196.00, 220.00]; // D3, E3, G3, A3
      bassFreq = notes[Math.floor(step / 4) % notes.length];
    }

    // Play bass double notes every other step
    if (step % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(bassFreq, now);
      
      gain.gain.setValueAtTime(0.12 * this.bgmVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    // 2. High Hat click (filtered short white noise block)
    if (step % 4 === 2) {
      this.playSynthNoiseHat(now);
    }

    // 3. Cute Melody Note
    // Classic chiptune lead
    let melodyFreq = 0;
    if (this.activeTheme === 'FARM') {
      // Bouncing nursery melody
      const melodyPattern = [523.25, 0, 587.33, 659.25, 0, 783.99, 0, 880.00,  659.25, 0, 587.33, 523.25, 0, 392.00, 0, 0]; // C5, D5, E5, G5, A5
      melodyFreq = melodyPattern[step];
    } else if (this.activeTheme === 'FACTORY') {
      // Intensive minor mode machine runs
      const melodyPattern = [440.00, 440.00, 523.25, 0, 493.88, 0, 349.23, 392.00,  440.00, 0, 587.33, 523.25, 0, 659.25, 0, 0]; // A4, C5, B4, F4, G4, D5...
      melodyFreq = melodyPattern[step];
    } else {
      // Champion fanfare
      const melodyPattern = [587.33, 587.33, 783.99, 0, 880.00, 0, 987.77, 1046.50,  1174.66, 0, 987.77, 880.00, 0, 783.99, 0, 0];
      melodyFreq = melodyPattern[step];
    }

    if (melodyFreq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.activeTheme === 'FACTORY' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(melodyFreq, now);

      // Sweet chiptune vibrato
      if (this.activeTheme === 'FACTORY') {
         osc.frequency.linearRampToValueAtTime(melodyFreq + 10, now + 0.1);
      }

      gain.gain.setValueAtTime(0.06 * this.bgmVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }

    this.seqStep = (this.seqStep + 1) % 16;
  }

  private playSynthNoiseHat(time: number) {
    if (!this.ctx || !this.bgmGain) return;
    const bufferSize = this.ctx.sampleRate * 0.03; // extremely short 30ms block
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.03 * this.bgmVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    noise.start(time);
    noise.stop(time + 0.03);
  }

  // --- Synthesized SFX API ---

  public playClick() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'UI Click';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

    gain.gain.setValueAtTime(0.3 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playFootstep(surface: string) {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    // Distinct soft pops for steps
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    let stepFreq = 160;
    let decay = 0.03;
    if (surface === 'FACTORY') {
      stepFreq = 110;
      decay = 0.04;
    } else if (surface === 'GRASS') {
      stepFreq = 220;
    }

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(stepFreq, now);
    osc.frequency.linearRampToValueAtTime(45, now + decay);

    gain.gain.setValueAtTime(0.08 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + decay + 0.01);
  }

  public playLandingDust() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);

    gain.gain.setValueAtTime(0.12 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playJump() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Jump Whoosh';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.16);

    gain.gain.setValueAtTime(0.18 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playCluck() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Chicken Cluck';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.08);
    osc.frequency.linearRampToValueAtTime(310, now + 0.14);

    gain.gain.setValueAtTime(0.14 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playSlide() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.2);

    gain.gain.setValueAtTime(0.14 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playLevelUp() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Evolution Sparkle';
    const now = this.ctx.currentTime;
    
    // Play a delightful chiptune victory chord arpeggio
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.16 * this.sfxVol, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  public playScoreFeed() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const timeDelta = now - this.lastCollectTime;
    
    if (timeDelta < 0.8) {
      this.collectCombo = Math.min(8, this.collectCombo + 1);
    } else {
      this.collectCombo = 0;
    }
    this.lastCollectTime = now;

    // Incremental pitched up synth notes (Mario coin collect progression)
    const baseFreq = 660 + (this.collectCombo * 28); // climbing pitch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.setValueAtTime(baseFreq * 1.35, now + 0.03); // sweet double blip!

    gain.gain.setValueAtTime(0.16 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playScoreGem() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Gem Collected';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6 sparkle!

    gain.gain.setValueAtTime(0.22 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playPowerUp() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Bonus Magnet Shield';
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(350, now);
    osc1.frequency.linearRampToValueAtTime(800, now + 0.25);
    osc2.frequency.setValueAtTime(450, now);
    osc2.frequency.linearRampToValueAtTime(900, now + 0.25);

    gain.gain.setValueAtTime(0.25 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc1.stop(now + 0.3);
    osc2.start(now);
    osc2.stop(now + 0.3);
  }

  public playNearMiss() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Close Whoosh';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.14);

    gain.gain.setValueAtTime(0.18 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playEggCrack() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Shell Cracking';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(0.2 * this.sfxVol, now);
    // Add rapid crunch noise simulation
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHit() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.35 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playGameOver() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Game Over Song';
    const now = this.ctx.currentTime;
    const notes = [293.66, 277.18, 261.63, 220.00]; // D4, C#4, C4, A3 sad descent
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.18);

      gain.gain.setValueAtTime(0.25 * this.sfxVol, now + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.24);
    });
  }

  public playEggSmash() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Egg Splat Smash';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.1);

    gain.gain.setValueAtTime(0.32 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playBirdChirp() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.05);

    gain.gain.setValueAtTime(0.1 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playThunderBoom() {
    this.ensureContext();
    if (!this.soundEnabled || !this.ctx || !this.sfxGain) return;

    this.currentSfx = 'Lightning Thunder';
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.4);

    gain.gain.setValueAtTime(0.35 * this.sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playCityAmbience() {
    // Noop / Procedural wind handles ambient loop
  }

  // --- Music Operations Hooks ---
  public startMusic() {
    this.ensureContext();
    if (this.musicEnabled) {
      this.startBgmSequencer();
    }
  }

  public stopMusic() {
    this.stopBgmSequencer();
  }

  // --- Ambience/Weather Operations ---
  public updateWeatherAmbience(weather: string, timeOfDay: number) {
    this.currentAmbient = `Outdoor Ambience (${weather})`;
  }

  public stopWeatherAmbience() {
    this.currentAmbient = 'None';
  }
}

export const soundManager = new SoundManager();
