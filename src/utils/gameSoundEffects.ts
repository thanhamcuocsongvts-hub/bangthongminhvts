/**
 * Classroom Educational Game Sound Synthesizer using Web Audio API
 * Zero external audio files required, zero latency, runs 100% offline
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound 1: Wheel Tick during spin
   */
  public playWheelTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (_) {}
  }

  /**
   * Sound 2: Correct Answer Chime
   */
  public playCorrectChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = this.ctx!.currentTime + idx * 0.09;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch (_) {}
  }

  /**
   * Sound 3: Wrong Answer Buzz
   */
  public playWrongBuzz() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    } catch (_) {}
  }

  /**
   * Sound 4: Grand Victory Fanfare
   */
  public playVictoryFanfare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const fanfare = [
        { f: 523.25, d: 0.12 }, // C5
        { f: 659.25, d: 0.12 }, // E5
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.5, d: 0.35 }, // C6
        { f: 880.0, d: 0.15 },  // A5
        { f: 1046.5, d: 0.6 },  // C6 long
      ];

      let cur = this.ctx.currentTime;
      fanfare.forEach((n) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, cur);

        gain.gain.setValueAtTime(0.22, cur);
        gain.gain.exponentialRampToValueAtTime(0.01, cur + n.d);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(cur);
        osc.stop(cur + n.d + 0.05);
        cur += n.d + 0.03;
      });
    } catch (_) {}
  }

  /**
   * Sound 5: Race Car Engine Acceleration (Vroom!)
   */
  public playEngineRev() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.45);
      osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.9);
    } catch (_) {}
  }

  /**
   * Sound 6: Nitro Speed Boost Whoosh
   */
  public playNitroBoost() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      // Noise burst for nitro whoosh
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
    } catch (_) {}
  }

  /**
   * Sound 7: Card Flip / Mystery Tile
   */
  public playCardFlip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (_) {}
  }

  /**
   * Sound 8: Millionaire Suspense Heartbeat
   */
  public playSuspenseHeartbeat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      // Lub
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(75, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.1);
      gain1.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start();
      osc1.stop(this.ctx.currentTime + 0.13);

      // Dub
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(70, this.ctx.currentTime + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.28);
      gain2.gain.setValueAtTime(0.2, this.ctx.currentTime + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(this.ctx.currentTime + 0.18);
      osc2.stop(this.ctx.currentTime + 0.32);
    } catch (_) {}
  }

  /* ========================================================================= */
  /* TRỌN BỘ NHẠC HIỆU VÀ ÂM THANH GAMESHOW "AI LÀ TRIỆU PHÚ" TRUYỀN HÌNH       */
  /* ========================================================================= */

  private suspenseDroneOsc: OscillatorNode | null = null;
  private suspenseDroneGain: GainNode | null = null;
  private suspenseInterval: any = null;

  /**
   * Sound 9: Nhạc Hiệu Mở Đầu Gameshow Ai Là Triệu Phú (Opening Fanfare - Chuẩn Keith Strachan VTV3)
   * Tái hiện chính xác 100% giai điệu huyền thoại của Ai Là Triệu Phú:
   * 1. Hợp âm đệm sâu lắng C minor
   * 2. Giai điệu kinh điển 7 nốt: G3 -> C4 -> D4 -> Eb4 -> D4 -> C4 -> G3
   * 3. Bốn hợp âm dồn dập cao trào: Cm -> Eb -> Fm -> G
   * 4. Cú đánh trống timpani + cymbal crash bùng nổ kết màn
   */
  public playMillionaireTheme() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopSuspenseMusic();

    try {
      const now = this.ctx.currentTime;

      // 1. Warm cinematic string pad sustaining C minor (C2 + G2 + C3)
      [65.41, 98.0, 130.81].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + 4.5);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 5.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 5.3);
      });

      // 2. Giai điệu kinh điển 7 nốt nhận diện thương hiệu "Ai Là Triệu Phú":
      // G3 (196.0) -> C4 (261.63) -> D4 (293.66) -> Eb4 (311.13) -> D4 (293.66) -> C4 (261.63) -> G3 (196.0)
      const melodyNotes = [
        { f: 196.0, t: 0.2, d: 0.38 },   // G3
        { f: 261.63, t: 0.65, d: 0.38 },  // C4
        { f: 293.66, t: 1.1, d: 0.28 },   // D4
        { f: 311.13, t: 1.45, d: 0.38 },  // Eb4
        { f: 293.66, t: 1.9, d: 0.28 },   // D4
        { f: 261.63, t: 2.25, d: 0.4 },   // C4
        { f: 196.0, t: 2.75, d: 0.6 },    // G3 (ngân dài)
      ];

      melodyNotes.forEach((n) => {
        const start = now + n.t;

        const osc1 = this.ctx!.createOscillator();
        const osc2 = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(n.f, start);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(n.f * 2, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.005, start + n.d);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx!.destination);

        osc1.start(start);
        osc1.stop(start + n.d + 0.05);
        osc2.start(start);
        osc2.stop(start + n.d + 0.05);
      });

      // 3. Chuỗi hợp âm dồn dập kịch tính đặc trưng (Orchestral Stabs):
      // Chord 1: Cm (t=3.4s) -> Chord 2: Eb (t=3.85s) -> Chord 3: Fm (t=4.3s) -> Chord 4: G (t=4.75s)
      const chords = [
        { time: 3.4, notes: [261.63, 311.13, 392.0] },
        { time: 3.85, notes: [311.13, 392.0, 466.16] },
        { time: 4.3, notes: [349.23, 415.3, 523.25] },
        { time: 4.75, notes: [392.0, 493.88, 587.33] },
      ];

      chords.forEach((chord) => {
        const cTime = now + chord.time;
        chord.notes.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, cTime);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, cTime);
          filter.frequency.exponentialRampToValueAtTime(300, cTime + 0.35);

          gain.gain.setValueAtTime(0.14, cTime);
          gain.gain.exponentialRampToValueAtTime(0.005, cTime + 0.38);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(cTime);
          osc.stop(cTime + 0.4);
        });
      });

      // 4. Climax Boom: Timpani Thud + Shimmering Gong Crash (t = 5.2s)
      const climaxTime = now + 5.2;

      // Timpani Sub-bass Boom
      const timpani = this.ctx.createOscillator();
      const timpaniGain = this.ctx.createGain();
      timpani.type = 'sine';
      timpani.frequency.setValueAtTime(110, climaxTime);
      timpani.frequency.exponentialRampToValueAtTime(45, climaxTime + 0.8);
      timpaniGain.gain.setValueAtTime(0.35, climaxTime);
      timpaniGain.gain.exponentialRampToValueAtTime(0.005, climaxTime + 1.2);
      timpani.connect(timpaniGain);
      timpaniGain.connect(this.ctx.destination);
      timpani.start(climaxTime);
      timpani.stop(climaxTime + 1.3);

      // Final Grand C Minor Chord
      [130.81, 196.0, 261.63, 311.13, 523.25].forEach((freq) => {
        const fOsc = this.ctx!.createOscillator();
        const fGain = this.ctx!.createGain();
        fOsc.type = 'triangle';
        fOsc.frequency.setValueAtTime(freq, climaxTime);
        fGain.gain.setValueAtTime(0.18, climaxTime);
        fGain.gain.exponentialRampToValueAtTime(0.002, climaxTime + 2.0);
        fOsc.connect(fGain);
        fGain.connect(this.ctx!.destination);
        fOsc.start(climaxTime);
        fOsc.stop(climaxTime + 2.1);
      });

      // Shimmering Crash Noise
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2200, climaxTime);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, climaxTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, climaxTime + 1.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(climaxTime);
    } catch (_) {}
  }

  /**
   * Sound 10: Âm Thanh Mở Câu Hỏi Mới (Question Intro Stinger - Ngắn 1.2s, KHÔNG lặp lại)
   * Phát đúng 1 lần khi chuyển câu hỏi, êm ái, lịch sự, không gây mệt mỏi
   */
  public playQuestionStinger(level: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Nhẹ nhàng, sang trọng (C4 -> G4 -> C5)
      const notes = [261.63, 392.0, 523.25];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = now + idx * 0.12;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(t);
        osc.stop(t + 0.65);
      });
    } catch (_) {}
  }

  /**
   * Safe stop function
   */
  public stopSuspenseMusic() {
    if (this.suspenseInterval) {
      clearInterval(this.suspenseInterval);
      this.suspenseInterval = null;
    }
    if (this.suspenseDroneGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.suspenseDroneGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
        setTimeout(() => {
          if (this.suspenseDroneOsc) {
            try {
              this.suspenseDroneOsc.stop();
              this.suspenseDroneOsc.disconnect();
            } catch (_) {}
            this.suspenseDroneOsc = null;
          }
          this.suspenseDroneGain = null;
        }, 150);
      } catch (_) {
        this.suspenseDroneOsc = null;
        this.suspenseDroneGain = null;
      }
    }
  }

  /**
   * Sound 11: Âm Thanh Chốt Đáp Án (Final Answer Stinger / Lock-in)
   * Tiếng bass drop đanh thép khi chọn câu trả lời cuối cùng
   */
  public playLockInAnswer() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);

      // Sharp metallic click
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(950, now);
      click.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      clickGain.gain.setValueAtTime(0.18, now);
      clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
      click.connect(clickGain);
      clickGain.connect(this.ctx.destination);
      click.start(now);
      click.stop(now + 0.1);
    } catch (_) {}
  }

  /**
   * Sound 12: Âm Thanh Hồi Hộp Trước Khi Công Bố Kết Quả (Suspense Drumroll)
   */
  public playSuspenseDrumroll() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // 4 quick heartbeat pulses accelerating
      [0, 0.22, 0.42, 0.58].forEach((offset) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now + offset);
        osc.frequency.exponentialRampToValueAtTime(45, now + offset + 0.12);
        gain.gain.setValueAtTime(0.22, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      });
    } catch (_) {}
  }

  /**
   * Sound 13: Âm Thanh Trả Lời Đúng Gameshow (Climax Correct Fanfare)
   * Tùy chỉnh theo cấp độ câu hỏi, mốc an toàn, và chiến thắng chung cuộc
   */
  public playMillionaireCorrect(level: number = 1, isMilestone = false, isGrandVictory = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopSuspenseMusic();

    try {
      const now = this.ctx.currentTime;

      if (isGrandVictory) {
        // Grand Champion Fanfare (Vua Tri Thức Triệu Phú)
        const victoryFanfare = [
          { f: 523.25, d: 0.15 },
          { f: 659.25, d: 0.15 },
          { f: 783.99, d: 0.15 },
          { f: 1046.5, d: 0.35 },
          { f: 880.0, d: 0.2 },
          { f: 987.77, d: 0.2 },
          { f: 1046.5, d: 0.8 },
        ];
        let cur = now;
        victoryFanfare.forEach((n) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.f, cur);
          gain.gain.setValueAtTime(0.24, cur);
          gain.gain.exponentialRampToValueAtTime(0.01, cur + n.d);
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(cur);
          osc.stop(cur + n.d + 0.05);
          cur += n.d + 0.04;
        });
        setTimeout(() => this.playApplause(), 300);
      } else if (isMilestone) {
        // Milestone Fanfare (Mốc quan trọng 5, 10)
        const milestoneNotes = [
          { f: 523.25, d: 0.12 },
          { f: 659.25, d: 0.12 },
          { f: 783.99, d: 0.18 },
          { f: 1046.5, d: 0.55 },
        ];
        let cur = now;
        milestoneNotes.forEach((n) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.f, cur);
          gain.gain.setValueAtTime(0.22, cur);
          gain.gain.exponentialRampToValueAtTime(0.01, cur + n.d);
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(cur);
          osc.stop(cur + n.d + 0.05);
          cur += n.d + 0.03;
        });
        setTimeout(() => this.playApplause(), 250);
      } else {
        // Regular Correct Stinger
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          const t = now + idx * 0.08;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.18, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(t);
          osc.stop(t + 0.38);
        });
      }
    } catch (_) {}
  }

  /**
   * Sound 14: Âm Thanh Trả Lời Sai (Dramatic Elimination Drop)
   */
  public playMillionaireWrong() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopSuspenseMusic();

    try {
      const now = this.ctx.currentTime;

      // Dissonant low slide
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(146.83, now); // D3
      osc1.frequency.linearRampToValueAtTime(73.42, now + 0.6); // D2
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.7);

      // Low ominous thud
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(80, now);
      osc2.frequency.exponentialRampToValueAtTime(35, now + 0.5);
      gain2.gain.setValueAtTime(0.25, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.6);
    } catch (_) {}
  }

  /**
   * Sound 15: Quyền Trợ Giúp 50:50 (Whoosh and vanishing zap)
   */
  public playLifeline5050() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Whoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // 2 quick vanish clicks
      [0.08, 0.18].forEach((off) => {
        const zap = this.ctx!.createOscillator();
        const zapGain = this.ctx!.createGain();
        zap.type = 'triangle';
        zap.frequency.setValueAtTime(1100, now + off);
        zap.frequency.exponentialRampToValueAtTime(350, now + off + 0.06);
        zapGain.gain.setValueAtTime(0.14, now + off);
        zapGain.gain.exponentialRampToValueAtTime(0.01, now + off + 0.07);
        zap.connect(zapGain);
        zapGain.connect(this.ctx!.destination);
        zap.start(now + off);
        zap.stop(now + off + 0.08);
      });
    } catch (_) {}
  }

  /**
   * Sound 16: Quyền Trợ Giúp Khán Giả Trường Quay / Cả Lớp
   */
  public playLifelineAudience() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Rising radar beeps
      [400, 520, 680, 880].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = now + idx * 0.09;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.09);
      });
    } catch (_) {}
  }

  /**
   * Sound 17: Quyền Gọi Điện Thoại (Telephone Ringing)
   */
  public playLifelineCall() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Dual tone ring (440Hz + 480Hz)
      [440, 480].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.setValueAtTime(0.12, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      });
    } catch (_) {}
  }

  /**
   * Sound 18: Quyền Đổi Câu Hỏi (Switch Question)
   */
  public playLifelineSwitch() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [350, 500, 700, 950].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = now + idx * 0.06;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    } catch (_) {}
  }

  /**
   * Sound 19: Tiếng Vỗ Tay Khán Giả (Crowd Applause)
   */
  public playApplause() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 1.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.6));
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
    } catch (_) {}
  }
}

export const gameSounds = new SoundSynthesizer();

