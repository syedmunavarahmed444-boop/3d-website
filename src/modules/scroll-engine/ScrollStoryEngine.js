import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHAPTERS, PRODUCTS } from '../brand/storeData.js';

gsap.registerPlugin(ScrollTrigger);

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * Coordinates Lenis smooth scroll + GSAP ScrollTrigger into a deterministic
 * chapter timeline (hold while reading, travel cleanly between shots).
 */
export class ScrollStoryEngine {
  constructor({ trackEl, onUpdate }) {
    this.trackEl = trackEl;
    this.onUpdate = onUpdate;
    this.progress = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._lenis = null;
    this._rafCb = null;

    this._init();
  }

  _init() {
    if (!this.reducedMotion) {
      this._lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.4,
      });

      this._lenis.on('scroll', ScrollTrigger.update);
      this._rafCb = (time) => {
        this._lenis.raf(time * 1000);
      };
      gsap.ticker.add(this._rafCb);
      gsap.ticker.lagSmoothing(0);
    }

    ScrollTrigger.create({
      trigger: this.trackEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        this.progress = clamp01(self.progress);
        this._emit();
      },
    });

    this._emit();
  }

  scrollToProgress(targetProgress) {
    this._lenis?.resize();
    ScrollTrigger.refresh();
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const y = clamp01(targetProgress) * maxScroll;

    if (this._lenis && !this.reducedMotion) {
      this._lenis.scrollTo(y, { duration: 1.1 });
    } else {
      window.scrollTo({ top: y, behavior: 'auto' });
    }
  }

  getState(p = this.progress) {
    // 1. Active chapter index
    let chapterIdx = 0;
    for (let i = 0; i < CHAPTERS.length; i++) {
      const [start, end] = CHAPTERS[i].range;
      if (p >= start && (p <= end || i === CHAPTERS.length - 1)) {
        chapterIdx = i;
        break;
      }
    }

    const ch = CHAPTERS[chapterIdx];
    const [twStart, twEnd] = ch.textWindow;

    // Text fades in at twStart, holds full opacity, fades out before camera travels
    let textOpacity = 0;
    const fadePad = 0.014;
    if (p >= twStart && p <= twEnd) {
      const fadeIn = chapterIdx === 0 ? 1 : clamp01((p - twStart) / fadePad);
      const fadeOut =
        chapterIdx === CHAPTERS.length - 1 ? 1 : clamp01((twEnd - p) / fadePad);
      textOpacity = Math.min(fadeIn, fadeOut);
    }

    // 2. Camera interpolation: hold steady inside textWindow, travel between chapters
    let camPos = ch.camera.pos;
    let camTarget = ch.camera.target;

    if (chapterIdx < CHAPTERS.length - 1) {
      const next = CHAPTERS[chapterIdx + 1];
      const travelStart = twEnd;
      const travelEnd = next.textWindow[0];
      if (p > travelStart && travelEnd > travelStart) {
        const t = smoothstep((p - travelStart) / (travelEnd - travelStart));
        camPos = lerpVec3(ch.camera.pos, next.camera.pos, t);
        camTarget = lerpVec3(ch.camera.target, next.camera.target, t);
      }
    }

    // Gentle parallax glide across the 7 product stops inside Chapter 3 (20%..42%)
    let activeProductIdx = 0;
    if (chapterIdx === 2) {
      const [cStart, cEnd] = ch.range;
      const localT = clamp01((p - cStart) / (cEnd - cStart));
      activeProductIdx = Math.min(
        PRODUCTS.length - 1,
        Math.floor(localT * PRODUCTS.length)
      );
      camPos = [
        camPos[0],
        camPos[1] - Math.sin(localT * Math.PI) * 0.05,
        camPos[2] - localT * 2.4,
      ];
      camTarget = [camTarget[0], camTarget[1], camTarget[2] - localT * 2.4];
    }

    // 3. Shutter lift directly tied to scroll (9%..20%), reverses cleanly when scrolling up
    const shutterOpen = smoothstep((p - 0.08) / 0.11);

    return {
      progress: p,
      chapterIdx,
      chapter: ch,
      textOpacity,
      camPos,
      camTarget,
      shutterOpen,
      activeProductIdx,
      reducedMotion: this.reducedMotion,
    };
  }

  _emit() {
    this.onUpdate?.(this.getState(this.progress));
  }

  destroy() {
    if (this._rafCb) {
      gsap.ticker.remove(this._rafCb);
    }
    this._lenis?.destroy();
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }
}
