import { ShowroomStage } from './modules/scene/ShowroomStage.js';
import { OnboardingStore } from './modules/onboarding/OnboardingStore.js';
import { CartStore } from './modules/cart/CartStore.js';
import { ShowroomUXController } from './modules/showroom-ux/ShowroomUXController.js';

const canvas = document.getElementById('webgl-stage');

const onboarding = new OnboardingStore();
const cart = new CartStore();

let stage = null;

const ux = new ShowroomUXController({
  onboarding,
  cart,
  onStageChange(stageState) {
    stage?.applyStoryState(stageState);
  },
  onEnterExplore() {
    stage?.enterExploreMode();
  },
  onFocusSection(sectionId) {
    stage?.focusSection(sectionId);
  },
});

stage = new ShowroomStage(canvas, {
  onProgress(pct) {
    ux.setLoadProgress(pct);
  },
  onReady() {
    ux.setLoadProgress(100);
    ux.hideLoader();
  },
  onError() {
    ux.hideLoader();
  },
  onSelectSection(sectionId) {
    ux.handle3DSectionClick(sectionId);
  },
  onUserSwipe() {
    ux.dismissRoamHint();
  },
});

ux.setPhase('onboarding');
