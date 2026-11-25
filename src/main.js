import { ScrollStoryEngine } from './modules/scroll-engine/ScrollStoryEngine.js';
import { ShowroomStage } from './modules/scene/ShowroomStage.js';
import { StoryOverlay } from './modules/story-ui/StoryOverlay.js';
import { CHAPTERS } from './modules/brand/storeData.js';

const canvas = document.getElementById('webgl-stage');
const trackEl = document.getElementById('scroll-track');

let engine = null;
let stage = null;
let currentChapterIdx = 0;

function jumpToChapterIndex(idx) {
  const clamped = Math.max(0, Math.min(CHAPTERS.length - 1, idx));
  const ch = CHAPTERS[clamped];
  const targetP = clamped === 0 ? 0 : (ch.textWindow[0] + ch.textWindow[1]) * 0.5;
  engine?.scrollToProgress(targetP);
}

const overlay = new StoryOverlay({
  onJumpChapter(targetProgress) {
    engine?.scrollToProgress(targetProgress);
  },
  onStepChapter(delta) {
    jumpToChapterIndex(currentChapterIdx + delta);
  },
  onToggleClassic(isOpen) {
    stage?.setPaused(isOpen);
  },
});

stage = new ShowroomStage(canvas, {
  onProgress(pct) {
    overlay.setLoadProgress(pct);
  },
  onReady() {
    overlay.setLoadProgress(100);
    overlay.hideLoader();
  },
  onError() {
    overlay.hideLoader();
  },
});

engine = new ScrollStoryEngine({
  trackEl,
  onUpdate(state) {
    currentChapterIdx = state.chapterIdx;
    overlay.update(state);
    stage.applyStoryState(state);
  },
});

// Keyboard accessibility: Left / Right arrows jump cleanly between showroom chapters
window.addEventListener('keydown', (e) => {
  if (overlay.isClassicOpen) {
    if (e.key === 'Escape') overlay.setClassicOpen(false);
    return;
  }
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    jumpToChapterIndex(currentChapterIdx + 1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    jumpToChapterIndex(currentChapterIdx - 1);
  }
});
