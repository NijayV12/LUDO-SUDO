class LudoAudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.musicVolume = 0.15;
        this.sfxVolume = 0.3;
        this.musicGainNode = null;
        this.sfxGainNode = null;
        this.bassInterval = null;
        this.musicPlaying = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (!this.musicGainNode) {
            this.musicGainNode = this.ctx.createGain();
            this.musicGainNode.gain.setValueAtTime(this.muted ? 0 : this.musicVolume, this.ctx.currentTime);
            this.musicGainNode.connect(this.ctx.destination);
        }
        if (!this.sfxGainNode) {
            this.sfxGainNode = this.ctx.createGain();
            this.sfxGainNode.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.ctx.currentTime);
            this.sfxGainNode.connect(this.ctx.destination);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        const targetMusicVol = this.muted ? 0 : this.musicVolume;
        const targetSfxVol = this.muted ? 0 : this.sfxVolume;
        if (this.musicGainNode) {
            this.musicGainNode.gain.setValueAtTime(targetMusicVol, this.ctx.currentTime);
        }
        if (this.sfxGainNode) {
            this.sfxGainNode.gain.setValueAtTime(targetSfxVol, this.ctx.currentTime);
        }
        return this.muted;
    }

    setMusicVolume(vol) {
        this.musicVolume = vol;
        if (this.musicGainNode) {
            this.musicGainNode.gain.setTargetAtTime(this.muted ? 0 : vol, this.ctx.currentTime, 0.05);
        }
    }

    setSfxVolume(vol) {
        this.sfxVolume = vol;
        if (this.sfxGainNode) {
            this.sfxGainNode.gain.setTargetAtTime(this.muted ? 0 : vol, this.ctx.currentTime, 0.05);
        }
    }

    startMusic() {
        this.init();
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.playSynthwaveLoop();
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.bassInterval) {
            clearInterval(this.bassInterval);
            this.bassInterval = null;
        }
    }

    createOscillator(type, freq, duration, gainStart, gainEnd = 0.001) {
        if (this.muted) return null;
        this.init();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(gainEnd, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.sfxGainNode || this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);

        return { osc, gainNode };
    }

    playRoll() {
        if (this.muted) return;
        this.init();

        const duration = 0.4;
        const steps = 6;
        const now = this.ctx.currentTime;

        for (let i = 0; i < steps; i++) {
            const time = now + (i * (duration / steps));
            
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.frequency.setValueAtTime(1000 + Math.random() * 2000, time);
            osc.type = 'triangle';
            
            gainNode.gain.setValueAtTime(0.08, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            
            osc.connect(gainNode);
            gainNode.connect(this.sfxGainNode || this.ctx.destination);
            
            osc.start(time);
            osc.stop(time + 0.05);
        }
    }

    playStep(stepIndex = 0) {
        const baseFreq = 261.63; // C4
        const freqMultiplier = 1 + (stepIndex % 12) * 0.08;
        const targetFreq = baseFreq * freqMultiplier;

        const duration = 0.12;
        const sound = this.createOscillator('sine', targetFreq, duration, 0.2);
        if (sound) {
            sound.osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.5, this.ctx.currentTime + duration);
        }
    }

    playRelease() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

        notes.forEach((freq, idx) => {
            const time = now + idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gainNode.gain.setValueAtTime(0.15, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

            osc.connect(gainNode);
            gainNode.connect(this.sfxGainNode || this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.25);
        });
    }

    playCapture() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const duration = 0.6;

        const osc = this.ctx.createOscillator();
        const oscNoise = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + duration);

        oscNoise.type = 'square';
        oscNoise.frequency.setValueAtTime(120, now);
        oscNoise.frequency.setValueAtTime(20, now + duration);

        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        oscNoise.connect(gainNode);
        gainNode.connect(this.sfxGainNode || this.ctx.destination);

        osc.start(now);
        oscNoise.start(now);
        
        osc.stop(now + duration);
        oscNoise.stop(now + duration);
    }

    playHome() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const chords = [
            { f: [261.63, 329.63, 392.00], t: 0 },       // C4, E4, G4
            { f: [392.00, 493.88, 587.33], t: 0.15 },    // G4, B4, D5
            { f: [523.25, 659.25, 783.99, 1046.50], t: 0.3 } // C5, E5, G5, C6
        ];

        chords.forEach((chord) => {
            chord.f.forEach((freq) => {
                const playTime = now + chord.t;
                const osc = this.ctx.createOscillator();
                const gainNode = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, playTime);

                gainNode.gain.setValueAtTime(0.08, playTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, playTime + 0.35);

                osc.connect(gainNode);
                gainNode.connect(this.sfxGainNode || this.ctx.destination);

                osc.start(playTime);
                osc.stop(playTime + 0.35);
            });
        });
    }

    playWin() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const duration = 0.8;
        
        const scale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        
        scale.forEach((freq, idx) => {
            const time = now + (idx * 0.1);
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            const vibrato = this.ctx.createOscillator();
            const vibratoGain = this.ctx.createGain();
            vibrato.frequency.value = 8;
            vibratoGain.gain.value = 10;

            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);

            gainNode.gain.setValueAtTime(0.1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(gainNode);
            gainNode.connect(this.sfxGainNode || this.ctx.destination);

            vibrato.start(time);
            osc.start(time);
            
            vibrato.stop(time + duration);
            osc.stop(time + duration);
        });
    }

    playSynthwaveLoop() {
        let step = 0;
        const notes = [
            110.00, 110.00, 130.81, 130.81,
            98.00, 98.00, 87.31, 87.31
        ];

        const playBassTone = (freq, duration) => {
            if (!this.musicPlaying || this.muted) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(300, this.ctx.currentTime);
                
                gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration - 0.02);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGainNode);
                
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch(e) {
                console.error("Synth play error:", e);
            }
        };

        const playPadTone = (freqs, duration) => {
            if (!this.musicPlaying || this.muted) return;
            try {
                freqs.forEach(f => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, this.ctx.currentTime);
                    
                    gain.gain.setValueAtTime(0, this.ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 0.8);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration - 0.2);
                    
                    osc.connect(gain);
                    gain.connect(this.musicGainNode);
                    
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                });
            } catch(e) {
                console.error("Synth play error:", e);
            }
        };

        this.bassInterval = setInterval(() => {
            if (!this.musicPlaying || this.muted) return;
            const currentFreq = notes[step % notes.length];
            playBassTone(currentFreq, 0.35);

            if (step % 8 === 0) {
                if (step % 16 === 0) {
                    playPadTone([220, 261.63, 329.63], 3.0);
                } else {
                    playPadTone([174.61, 220, 261.63], 3.0);
                }
            }
            step++;
        }, 400);
    }
}

const audioManager = new LudoAudioManager();
window.audioManager = audioManager;
