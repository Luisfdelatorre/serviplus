// Web Audio API Sound Generator para Kiosk y Cocina KDS
// Compatible con iOS Safari, iPadOS, Android Tablets y navegadores de escritorio

class SoundFX {
  constructor() {
    this.ctx = null;
    this.unlocked = false;

    // Desbloquear audio automáticamente al primer toque en tablets/móviles
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        ['touchstart', 'touchend', 'pointerdown', 'mousedown'].forEach((ev) => {
          window.removeEventListener(ev, unlock);
        });
      };
      ['touchstart', 'touchend', 'pointerdown', 'mousedown'].forEach((ev) => {
        window.addEventListener(ev, unlock, { once: true, passive: true });
      });
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    // En tablets (iOS / Android), AudioContext arranca en 'suspended' hasta que se hace resume()
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Desbloqueo universal de audio para iPad / Android (reproduce un buffer silencioso)
  unlockAudio() {
    this.init();
    if (!this.ctx || this.unlocked) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      this.unlocked = true;
    } catch {
      // Ignorar si el navegador aún bloquea
    }
  }

  // Sonido de campana para cocina (nueva comanda)
  playOrderBell() {
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Audio playback safety
    }
  }

  // Sonido de éxito cuando una orden está lista o se agrega al pedido
  playReadyChime() {
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.4, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + (i + 1) * 0.22);
      });
    } catch {
      // Audio playback safety
    }
  }

  // Sonido táctil audible en parlantes de tablets
  playTap() {
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Triangle genera armónicos audibles en altavoces pequeños de tablets
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio playback safety
    }
  }

  // Sonido de error o advertencia (Beep grave)
  playBeep() {
    this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio playback safety
    }
  }

  // Sonido de éxito
  playSuccess() {
    this.playReadyChime();
  }
}

export const sfx = new SoundFX();
