class LudoAudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
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
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);

        return { osc, gainNode };
    }

    playRoll() {
        if (this.muted) return;
        this.init();

        // Dice roll sound: create a rapid series of short clicking sounds (a brief noise-like effect)
        const duration = 0.4;
        const steps = 6;
        const now = this.ctx.currentTime;

        for (let i = 0; i < steps; i++) {
            const time = now + (i * (duration / steps));
            
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            // Random high frequency for a click/shake sound
            osc.frequency.setValueAtTime(1000 + Math.random() * 2000, time);
            osc.type = 'triangle';
            
            gainNode.gain.setValueAtTime(0.08, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start(time);
            osc.stop(time + 0.05);
        }
    }

    playStep(stepIndex = 0) {
        // A clean, bouncy plop sound
        // Increase pitch slightly with higher stepIndex to make moving feel progressive
        const baseFreq = 261.63; // C4
        const freqMultiplier = 1 + (stepIndex % 12) * 0.08;
        const targetFreq = baseFreq * freqMultiplier;

        const duration = 0.12;
        const sound = this.createOscillator('sine', targetFreq, duration, 0.2);
        if (sound) {
            // Add a slight frequency sweep
            sound.osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.5, this.ctx.currentTime + duration);
        }
    }

    playRelease() {
        // Uplifting sound: two quick, high chime-like notes (arpeggio)
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
            gainNode.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.25);
        });
    }

    playCapture() {
        // Falling retro explosion sound
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const duration = 0.6;

        const osc = this.ctx.createOscillator();
        const oscNoise = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        // Pitch slide down from high to low
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
        gainNode.connect(this.ctx.destination);

        osc.start(now);
        oscNoise.start(now);
        
        osc.stop(now + duration);
        oscNoise.stop(now + duration);
    }

    playHome() {
        // Happy little trumpet fanfare: standard chord C-E-G-C (high)
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
                gainNode.connect(this.ctx.destination);

                osc.start(playTime);
                osc.stop(playTime + 0.35);
            });
        });
    }

    playWin() {
        // Orchestral arpeggiated triumph fanfare
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const duration = 0.8;
        
        // A nice major arpeggio scaling up
        const scale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        
        scale.forEach((freq, idx) => {
            const time = now + (idx * 0.1);
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            // Add frequency vibrato
            const vibrato = this.ctx.createOscillator();
            const vibratoGain = this.ctx.createGain();
            vibrato.frequency.value = 8; // 8Hz vibrato
            vibratoGain.gain.value = 10; // pitch variation

            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);

            gainNode.gain.setValueAtTime(0.1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            vibrato.start(time);
            osc.start(time);
            
            vibrato.stop(time + duration);
            osc.stop(time + duration);
        });
    }
}

// Export a single instance to be used by game.js
const audioManager = new LudoAudioManager();
window.audioManager = audioManager; // attach to window for global access
