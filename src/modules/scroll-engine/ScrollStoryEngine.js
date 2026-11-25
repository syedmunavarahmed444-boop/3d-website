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

    let textOpacity = 0;
    const fadePad = 0.014;
    if (p >= twStart && p <= twEnd) {
      const fadeIn = chapterIdx === 0 ? 1 : clamp01((p - twStart) / fadePad);
      const fadeOut =
        chapterIdx === CHAPTERS.length - 1 ? 1 : clamp01((twEnd - p) / fadePad);
      textOpacity = Math.min(fadeIn, fadeOut);
    }

    let camPos = ch.camera.pos;
    let camTarget = ch.camera.target;
    let mascotState = ch.mascot;

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

    // Guided showroom pan across all 7 product racks inside Chapter 3 (with per-rack mascot staging)
    let activeProductIdx = 0;
    if (chapterIdx === 2) {
      const [tw0, tw1] = ch.textWindow;
      const localT = clamp01((p - tw0) / Math.max(0.001, tw1 - tw0));
      const scaled = localT * (PRODUCTS.length - 0.001);
      activeProductIdx = Math.min(PRODUCTS.length - 1, Math.floor(scaled));

      const currProd = PRODUCTS[activeProductIdx];
      const nextProd = PRODUCTS[Math.min(PRODUCTS.length - 1, activeProductIdx + 1)];
      const segFrac = scaled - activeProductIdx;
      const blendT = smoothstep((segFrac - 0.68) / 0.32);

      if (currProd?.mascot) {
        mascotState = currProd.mascot;
      }

      if (currProd?.focusCam && nextProd?.focusCam && p <= tw1) {
        camPos = lerpVec3(currProd.focusCam.pos, nextProd.focusCam.pos, blendT);
        camTarget = lerpVec3(currProd.focusCam.target, nextProd.focusCam.target, blendT);
      } else if (p > tw1 && chapterIdx < CHAPTERS.length - 1) {
        const lastFocus = PRODUCTS[PRODUCTS.length - 1].focusCam;
        const nextCh = CHAPTERS[chapterIdx + 1];
        const t = smoothstep((p - tw1) / Math.max(0.001, nextCh.textWindow[0] - tw1));
        camPos = lerpVec3(lastFocus.pos, nextCh.camera.pos, t);
        camTarget = lerpVec3(lastFocus.target, nextCh.camera.target, t);
      }
    }

    // Shutter lifts early (4.5%..12.5%) so by Shutter chapter midpoint (14.5%) it is 100% open!
    const shutterOpen = smoothstep((p - 0.045) / 0.08);

    return {
      progress: p,
      chapterIdx,
      chapter: ch,
      mascot: mascotState,
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
