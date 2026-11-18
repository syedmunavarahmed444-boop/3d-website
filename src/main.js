import { ScrollStoryEngine } from './modules/scroll-engine/ScrollStoryEngine.js';
import { Phase1Stage } from './modules/scene/Phase1Stage.js';
import { StoryOverlay } from './modules/story-ui/StoryOverlay.js';

const canvas = document.getElementById('webgl-stage');
const trackEl = document.getElementById('scroll-track');

let engine = null;

const overlay = new StoryOverlay({
  onJumpChapter(targetProgress) {
    engine?.scrollToProgress(targetProgress);
  },
});

const stage = new Phase1Stage(canvas, {
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
    overlay.update(state);
    stage.applyStoryState(state);
  },
});
