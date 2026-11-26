import QRCode from 'qrcode';
import { BRAND, PRODUCTS, SERVICES } from '../brand/storeData.js';

function formatInr(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Interactive 360° Free-Roam Showroom UX Controller
 *
 * - Top bar holds all compact controls: Search icon (⌕), Services, Call (✆), Switch User, Kit Bag (👜).
 * - Inside the shop, 100% of the viewport is open for swiping around every 3D corner & reading wall signs.
 * - Clicking/tapping any 3D object or wall sign opens a small, compact glassmorphic popup card with
 *   product photo stack trigger, description, and Retail/Wholesale pack steppers.
 */
export class ShowroomUXController {
  constructor({ onboarding, cart, onStageChange, onEnterExplore, onFocusSection }) {
    this.onboarding = onboarding;
    this.cart = cart;
    this.onStageChange = onStageChange;
    this.onEnterExplore = onEnterExplore;
    this.onFocusSection = onFocusSection;

    this.phase = 'onboarding'; // 'onboarding' | 'welcome' | 'inside'
    this.authTab = 'signup';
    this.activeSectionId = null; // Currently opened 3D product popup
    this.cardPhotoIdx = 0; // Active real photo index right inside the price card!
    this.popoverMode = null; // null | 'search' | 'services' | 'bag'
    this.searchQuery = '';

    // Swipeable 3D photo stack state
    this.stackProduct = null;
    this.stackIndex = 0;

    this._cacheElements();
    this._renderSectionStrip();
    this._bindOnboarding();
    this._bindWelcome();
    this._bindTopbarAndPopover();
    this._bindObjectPopup();
    this._bindPhotoStack();

    this.cart.subscribe((summary) => this._onCartUpdate(summary));
    this.setPhase('onboarding');
  }

  _cacheElements() {
    this.loader = document.getElementById('loader');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderPct = document.getElementById('loader-pct');

    this.topSearchBtn = document.getElementById('top-search-btn');
    this.topServicesBtn = document.getElementById('top-services-btn');
    this.signOutBtn = document.getElementById('signout-btn');
    this.kitBagBtn = document.getElementById('kitbag-open-btn');
    this.sectionStrip = document.getElementById('top-section-strip');

    this.topPopover = document.getElementById('top-popover');
    this.popoverTitle = document.getElementById('popover-title');
    this.popoverCloseBtn = document.getElementById('popover-close-btn');
    this.popoverSearchBox = document.getElementById('popover-search-box');
    this.searchInput = document.getElementById('catalog-search-input');
    this.popoverBody = document.getElementById('popover-body');

    this.onboardingGate = document.getElementById('onboarding-gate');
    this.authTabSignup = document.getElementById('auth-tab-signup');
    this.authTabLogin = document.getElementById('auth-tab-login');
    this.authForm = document.getElementById('auth-form');
    this.authNameField = document.getElementById('auth-name-field');
    this.authNameInput = document.getElementById('auth-name-input');
    this.authPhoneInput = document.getElementById('auth-phone-input');
    this.authSubmitBtn = document.getElementById('auth-submit-btn');
    this.guestBtn = document.getElementById('guest-continue-btn');

    this.welcomeHero = document.getElementById('welcome-hero');
    this.welcomeGreeting = document.getElementById('welcome-greeting');
    this.stepInsideBtn = document.getElementById('step-inside-btn');

    this.roamHint = document.getElementById('roam-hint');
    this.objectPopup = document.getElementById('object-popup');

    // Photo stack modal
    this.stackModal = document.getElementById('photo-stack-modal');
    this.stackBadge = document.getElementById('stack-cat-badge');
    this.stackTitle = document.getElementById('stack-title');
    this.stackCloseBtn = document.getElementById('stack-close-btn');
    this.stackPrevBtn = document.getElementById('stack-prev-btn');
    this.stackNextBtn = document.getElementById('stack-next-btn');
    this.stackDeck = document.getElementById('stack-deck');
    this.stackCaption = document.getElementById('stack-caption');
    this.stackCounter = document.getElementById('stack-counter');
    this.stackThumbs = document.getElementById('stack-thumbs');
  }

  setLoadProgress(pct) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (this.loaderBar) this.loaderBar.style.width = `${clamped}%`;
    if (this.loaderPct) this.loaderPct.textContent = `${clamped}%`;
  }

  hideLoader() {
    if (!this.loader) return;
    this.loader.classList.add('is-hidden');
    window.setTimeout(() => this.loader?.remove(), 600);
  }

  dismissRoamHint() {
    if (this.roamHint && !this.roamHint.hidden) {
      this.roamHint.classList.add('is-fading');
      window.setTimeout(() => {
        if (this.roamHint) this.roamHint.hidden = true;
      }, 320);
    }
  }

  _renderSectionStrip() {
    if (!this.sectionStrip) return;
    const pills = [
      `<button type="button" class="sec-chip" data-sec="__counter">Counter</button>`,
      ...PRODUCTS.map(
        (p) => `<button type="button" class="sec-chip" data-sec="${p.id}">${p.index} ${p.shortTab}</button>`
      ),
    ];
    this.sectionStrip.innerHTML = pills.join('');

    this.sectionStrip.addEventListener('click', (e) => {
      const chip = e.target.closest('button[data-sec]');
      if (!chip) return;
      const secId = chip.dataset.sec;
      this.dismissRoamHint();
      this.onFocusSection?.(secId);
      this.handle3DSectionClick(secId);
    });
  }

  _syncSectionChips() {
    if (!this.sectionStrip) return;
    this.sectionStrip.querySelectorAll('.sec-chip').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.sec === this.activeSectionId);
    });
  }

  _bindOnboarding() {
    this.authTabSignup?.addEventListener('click', () => this._setAuthTab('signup'));
    this.authTabLogin?.addEventListener('click', () => this._setAuthTab('login'));

    this.authForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.authNameInput?.value || '';
      const phone = this.authPhoneInput?.value || '';
      if (this.authTab === 'signup') {
        this.onboarding.signUp({ name, phone });
      } else {
        this.onboarding.logIn({ phone, name });
      }
      this.setPhase('welcome');
    });

    this.guestBtn?.addEventListener('click', () => {
      this.onboarding.continueAsGuest();
      this.setPhase('welcome');
    });
  }

  _setAuthTab(tab) {
    this.authTab = tab;
    const isSignup = tab === 'signup';
    this.authTabSignup?.classList.toggle('is-active', isSignup);
    this.authTabLogin?.classList.toggle('is-active', !isSignup);
    if (this.authNameField) this.authNameField.hidden = !isSignup;
    if (this.authSubmitBtn) {
      this.authSubmitBtn.textContent = isSignup ? 'Create Free Pass & Open Shutter →' : 'Sign In & Open Shutter →';
    }
  }

  _bindWelcome() {
    this.stepInsideBtn?.addEventListener('click', () => {
      this.setPhase('inside');
    });
  }

  _bindTopbarAndPopover() {
    this.topSearchBtn?.addEventListener('click', () => {
      this.togglePopover('search');
    });

    this.topServicesBtn?.addEventListener('click', () => {
      this.togglePopover('services');
    });

    this.kitBagBtn?.addEventListener('click', () => {
      if (this.phase !== 'inside') {
        if (!this.onboarding.getVisitor()) this.onboarding.continueAsGuest();
        this.setPhase('inside');
      }
      this.togglePopover('bag');
    });

    this.signOutBtn?.addEventListener('click', () => {
      this.onboarding.signOut();
      this.closeObjectPopup();
      this.closePopover();
      this.setPhase('onboarding');
    });

    this.popoverCloseBtn?.addEventListener('click', () => this.closePopover());

    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.trim();
      if (this.popoverMode === 'services') {
        this._renderServicesPopover();
      } else {
        this._renderSearchPopover();
      }
    });

    this.popoverBody?.addEventListener('click', (e) => {
      const jumpBtn = e.target.closest('[data-jump-prod]');
      if (jumpBtn) {
        const pid = jumpBtn.dataset.jumpProd;
        this.closePopover();
        this.onFocusSection?.(pid);
        this.openObjectPopup(pid);
        return;
      }

      const stackBtn = e.target.closest('button[data-open-stack]');
      if (stackBtn) {
        e.stopPropagation();
        this.openPhotoStack(stackBtn.dataset.openStack);
        return;
      }

      const stepBtn = e.target.closest('button[data-step]');
      if (stepBtn) {
        this.cart.adjust(stepBtn.dataset.pid, Number(stepBtn.dataset.pack), Number(stepBtn.dataset.step));
        return;
      }

      if (e.target.closest('[data-clear-bag]')) {
        this.cart.clear();
        return;
      }
      if (e.target.closest('[data-sample-bag]')) {
        this.cart.loadSampleClubOrder();
        return;
      }
      const copyBtn = e.target.closest('[data-copy-memo]');
      if (copyBtn) {
        navigator.clipboard?.writeText(this.cart.buildMemoText(this.onboarding.getVisitor())).then(() => {
          copyBtn.textContent = 'Copied ✓';
          window.setTimeout(() => {
            copyBtn.textContent = 'Copy Order Memo';
          }, 1600);
        });
      }
    });
  }

  _bindObjectPopup() {
    this.objectPopup?.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-obj]')) {
        this.closeObjectPopup();
        return;
      }
      const navBtn = e.target.closest('button[data-card-photo-step]');
      if (navBtn) {
        e.stopPropagation();
        this._stepCardPhoto(Number(navBtn.dataset.cardPhotoStep));
        return;
      }
      const dotBtn = e.target.closest('button[data-card-photo-dot]');
      if (dotBtn) {
        e.stopPropagation();
        this.cardPhotoIdx = Number(dotBtn.dataset.cardPhotoDot);
        this._updateInlineCardDeck();
        return;
      }
      const expandBtn = e.target.closest('[data-open-stack]');
      if (expandBtn && !this._cardDragged) {
        this.openPhotoStack(expandBtn.dataset.openStack, this.cardPhotoIdx);
        return;
      }
      const stepBtn = e.target.closest('button[data-step]');
      if (stepBtn) {
        this.cart.adjust(stepBtn.dataset.pid, Number(stepBtn.dataset.pack), Number(stepBtn.dataset.step));
        return;
      }
      if (e.target.closest('[data-open-bag-from-card]')) {
        this.closeObjectPopup();
        this.togglePopover('bag');
      }
    });

    // Direct touch & mouse swipe right on the price card's real-photo stack!
    let startX = null;
    let dx = 0;
    let frontSlide = null;
    this._cardDragged = false;

    this.objectPopup?.addEventListener('pointerdown', (e) => {
      const deck = e.target.closest('.obj-photo-deck');
      if (!deck || e.target.closest('button[data-card-photo-step]') || e.target.closest('button[data-card-photo-dot]')) {
        return;
      }
      frontSlide = deck.querySelector('.obj-slide[data-offset="0"]');
      if (!frontSlide) return;
      startX = e.clientX;
      dx = 0;
      this._cardDragged = false;
      frontSlide.classList.add('is-dragging');
      deck.setPointerCapture?.(e.pointerId);
    });

    this.objectPopup?.addEventListener('pointermove', (e) => {
      if (startX === null || !frontSlide) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 8) this._cardDragged = true;
      const rot = Math.max(-10, Math.min(10, dx * 0.04));
      frontSlide.style.transform = `translate3d(${dx}px, 0, 0) rotate(${rot}deg)`;
    });

    const endCardSwipe = () => {
      if (startX === null || !frontSlide) return;
      frontSlide.classList.remove('is-dragging');
      const moved = dx;
      startX = null;
      dx = 0;
      if (Math.abs(moved) > 42) {
        const dir = moved < 0 ? 1 : -1;
        frontSlide.style.transform = `translate3d(${moved < 0 ? -240 : 240}px, 8px, 0) rotate(${moved < 0 ? -12 : 12}deg)`;
        frontSlide.style.opacity = '0';
        const ref = frontSlide;
        frontSlide = null;
        window.setTimeout(() => {
          ref.style.transform = '';
          ref.style.opacity = '';
          this._stepCardPhoto(dir);
        }, 150);
      } else {
        frontSlide.style.transform = '';
        frontSlide = null;
      }
      window.setTimeout(() => {
        this._cardDragged = false;
      }, 60);
    };

    this.objectPopup?.addEventListener('pointerup', endCardSwipe);
    this.objectPopup?.addEventListener('pointercancel', endCardSwipe);
  }

  setPhase(nextPhase) {
    this.phase = nextPhase;
    const visitor = this.onboarding.getVisitor();
    const isInside = nextPhase === 'inside';

    if (this.onboardingGate) this.onboardingGate.hidden = nextPhase !== 'onboarding';
    if (this.welcomeHero) this.welcomeHero.hidden = nextPhase !== 'welcome';
    if (this.topSearchBtn) this.topSearchBtn.hidden = !isInside;
    if (this.topServicesBtn) this.topServicesBtn.hidden = !isInside;
    if (this.sectionStrip) this.sectionStrip.hidden = !isInside;
    if (this.signOutBtn) this.signOutBtn.hidden = nextPhase === 'onboarding';

    if (this.roamHint) {
      this.roamHint.classList.remove('is-fading');
      this.roamHint.hidden = !isInside;
    }

    if (!isInside) {
      this.closeObjectPopup();
      this.closePopover();
    }

    if (this.welcomeGreeting && visitor) {
      this.welcomeGreeting.textContent =
        visitor.name === 'Guest' ? 'Welcome to Sultan Sports!' : `Welcome, ${visitor.name}!`;
    }

    if (nextPhase === 'onboarding') {
      this.onStageChange?.({
        camPos: [0.55, 2.05, 13.6],
        camTarget: [0.35, 1.38, 1.8],
        shutterOpen: 0,
        mascot: { pos: [0.45, 0, 1.92], rotY: -0.06, anim: 'idle' },
      });
    } else if (nextPhase === 'welcome') {
      this.onStageChange?.({
        camPos: [0.38, 1.82, 11.4],
        camTarget: [0.18, 1.28, 0.4],
        shutterOpen: 1,
        mascot: { pos: [0.48, 0, 1.55], rotY: -0.08, anim: 'greet' },
      });
    } else if (nextPhase === 'inside') {
      this.onEnterExplore?.();
    }
  }

  /**
   * Triggered when the customer taps a 3D sports item, 3D wall sign, or top section chip!
   */
  handle3DSectionClick(sectionId) {
    this.dismissRoamHint();
    if (sectionId === '__counter') {
      this.closeObjectPopup();
      this.activeSectionId = '__counter';
      this._syncSectionChips();
      this.openPopover('bag');
      return;
    }
    this.closePopover();
    this.openObjectPopup(sectionId);
  }

  openObjectPopup(productId) {
    const prod = PRODUCTS.find((p) => p.id === productId);
    if (!prod || !this.objectPopup) return;
    if (this.activeSectionId !== prod.id) {
      this.cardPhotoIdx = 0;
    }
    this.activeSectionId = prod.id;
    this._syncSectionChips();

    const summary = this.cart.getSummary();

    const packsHtml = prod.packs
      .map((pack, idx) => {
        const qty = this.cart.getQty(prod.id, idx);
        const key = this.cart.makeKey(prod.id, idx);
        return `
          <div class="obj-pack-row ${qty > 0 ? 'has-qty' : ''}" data-pack-key="${key}">
            <div class="obj-pack-left">
              <span class="obj-pack-label">${pack.label}</span>
              <span class="obj-pack-price">${formatInr(pack.price)}</span>
            </div>
            <div class="obj-stepper">
              <button type="button" class="obj-step-btn" data-pid="${prod.id}" data-pack="${idx}" data-step="-1" aria-label="Remove ${pack.label}">−</button>
              <span class="obj-step-qty" data-qty-for="${key}">${qty}</span>
              <button type="button" class="obj-step-btn is-plus" data-pid="${prod.id}" data-pack="${idx}" data-step="1" aria-label="Add ${pack.label}">+</button>
            </div>
          </div>
        `;
      })
      .join('');

    this.objectPopup.innerHTML = `
      <div class="obj-head">
        <div class="obj-title-col">
          <span class="obj-sec-tag">SECTION ${prod.index} · FROM ${formatInr(prod.retailPrice)}</span>
          <h3 class="obj-title">${prod.name}</h3>
          <p class="obj-desc">${prod.subtitle}</p>
        </div>
        <button type="button" class="mini-close-btn" data-close-obj="1" aria-label="Close card">✕</button>
      </div>

      <!-- Inline Swipeable Real-Photo Stack Right on the Price Card -->
      <div class="obj-gallery-stage">
        <button type="button" class="obj-gal-arrow is-prev" data-card-photo-step="-1" aria-label="Previous real photo">‹</button>
        <div class="obj-photo-deck" data-open-stack="${prod.id}" title="Swipe left/right or tap to zoom"></div>
        <button type="button" class="obj-gal-arrow is-next" data-card-photo-step="1" aria-label="Next real photo">›</button>
      </div>

      <div class="obj-packs">${packsHtml}</div>

      <div class="obj-foot">
        <span class="obj-foot-note" data-obj-bag-summary>
          ${
            summary.totalPacks > 0
              ? `In Bag: ${summary.totalPacks} packs · ${formatInr(summary.totalAmount)}`
              : 'Swipe photos above · Tap + to add'
          }
        </span>
        <button type="button" class="obj-bag-link" data-open-bag-from-card="1">Kit Bag →</button>
      </div>
    `;

    this._updateInlineCardDeck();
    this.objectPopup.hidden = false;
  }

  _stepCardPhoto(delta) {
    const prod = PRODUCTS.find((p) => p.id === this.activeSectionId);
    if (!prod) return;
    const photos = prod.gallery?.length ? prod.gallery : [{ src: prod.image, caption: prod.name }];
    this.cardPhotoIdx = (this.cardPhotoIdx + delta + photos.length) % photos.length;
    this._updateInlineCardDeck();
  }

  _updateInlineCardDeck() {
    const prod = PRODUCTS.find((p) => p.id === this.activeSectionId);
    const deck = this.objectPopup?.querySelector('.obj-photo-deck');
    if (!prod || !deck) return;

    const photos = prod.gallery?.length ? prod.gallery : [{ src: prod.image, caption: prod.name }];
    const n = photos.length;
    const activeIdx = ((this.cardPhotoIdx % n) + n) % n;
    const activePhoto = photos[activeIdx];

    const slidesHtml = photos
      .map((item, idx) => {
        const offset = (idx - activeIdx + n) % n;
        return `
          <figure class="obj-slide" data-offset="${offset}">
            <img src="${item.src}" alt="${item.caption}" draggable="false" />
          </figure>
        `;
      })
      .join('');

    const dotsHtml = photos
      .map(
        (_, idx) => `
          <button
            type="button"
            class="obj-dot ${idx === activeIdx ? 'is-active' : ''}"
            data-card-photo-dot="${idx}"
            aria-label="Photo ${idx + 1}"
          ></button>
        `
      )
      .join('');

    deck.innerHTML = `
      ${slidesHtml}
      <div class="obj-slide-bar">
        <span class="obj-slide-cap">${activePhoto.caption}</span>
        <span class="obj-slide-count">${activeIdx + 1}/${n} ⤢</span>
      </div>
      <div class="obj-dots">${dotsHtml}</div>
    `;
  }

  closeObjectPopup() {
    this.activeSectionId = null;
    this._syncSectionChips();
    if (this.objectPopup) this.objectPopup.hidden = true;
  }

  /* =========================================================
     TOP-ANCHORED COMPACT POPOVER (SEARCH / SERVICES / KIT BAG)
     ========================================================= */
  togglePopover(mode) {
    if (this.popoverMode === mode && !this.topPopover?.hidden) {
      this.closePopover();
    } else {
      this.openPopover(mode);
    }
  }

  openPopover(mode) {
    if (!this.topPopover) return;
    this.closeObjectPopup();
    this.popoverMode = mode;
    this.topPopover.hidden = false;

    this.topSearchBtn?.classList.toggle('is-active', mode === 'search');
    this.topServicesBtn?.classList.toggle('is-active', mode === 'services');

    if (mode === 'search') {
      if (this.popoverTitle) this.popoverTitle.textContent = 'Search Products & Sports Gear';
      if (this.popoverSearchBox) this.popoverSearchBox.hidden = false;
      this._renderSearchPopover();
      window.setTimeout(() => this.searchInput?.focus(), 40);
    } else if (mode === 'services') {
      if (this.popoverTitle) this.popoverTitle.textContent = 'Play Areas, Nets & Court Services';
      if (this.popoverSearchBox) this.popoverSearchBox.hidden = true;
      this._renderServicesPopover();
    } else if (mode === 'bag') {
      if (this.popoverTitle) this.popoverTitle.textContent = 'Your Kit Bag & WhatsApp Order';
      if (this.popoverSearchBox) this.popoverSearchBox.hidden = true;
      this.onFocusSection?.('__counter');
      this._renderBagPopover(this.cart.getSummary());
    }
  }

  closePopover() {
    this.popoverMode = null;
    if (this.topPopover) this.topPopover.hidden = true;
    this.topSearchBtn?.classList.remove('is-active');
    this.topServicesBtn?.classList.remove('is-active');
  }

  _buildCustomWhatsAppUrl(message) {
    const visitor = this.onboarding.getVisitor();
    const customerTag =
      visitor && visitor.name && visitor.name !== 'Guest'
        ? `\nCustomer: ${visitor.name}${visitor.phone ? ` (${visitor.phone})` : ''}`
        : '';
    const primaryPhone = BRAND.phones[0].raw;
    return `https://wa.me/91${primaryPhone}?text=${encodeURIComponent(`${message}${customerTag}`)}`;
  }

  _renderSearchPopover() {
    if (!this.popoverBody) return;
    const q = this.searchQuery.toLowerCase();
    const filtered = q
      ? PRODUCTS.filter((prod) =>
          [prod.name, prod.subtitle, prod.shortTab, prod.index, ...prod.packs.map((p) => p.label)]
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : PRODUCTS;

    if (filtered.length === 0) {
      const askUrl = this._buildCustomWhatsAppUrl(
        `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! Do you have "${this.searchQuery}" in stock?`
      );
      this.popoverBody.innerHTML = `
        <div class="pop-empty">
          <strong>We stock almost everything in sports!</strong>
          <p>"${this.searchQuery}" isn't in the 3D preview shelves yet, but we likely have it in-store or wholesale.</p>
          <a href="${askUrl}" target="_blank" rel="noopener noreferrer" class="pop-wa-btn">
            Ask Mansoor for "${this.searchQuery}" on WhatsApp →
          </a>
        </div>
      `;
      return;
    }

    this.popoverBody.innerHTML = filtered
      .map(
        (prod) => `
          <div class="pop-search-item" data-jump-prod="${prod.id}">
            <button type="button" class="pop-thumb" data-open-stack="${prod.id}" title="View photos">
              <img src="${prod.image}" alt="${prod.name}" loading="lazy" />
              <span>⧉ ${prod.gallery?.length || 1}</span>
            </button>
            <div class="pop-item-info">
              <div class="pop-item-name">${prod.index} · ${prod.name}</div>
              <div class="pop-item-sub">From ${formatInr(prod.retailPrice)} · Tap to fly to 3D rack ↗</div>
            </div>
          </div>
        `
      )
      .join('');
  }

  _renderServicesPopover() {
    if (!this.popoverBody) return;
    const customQuoteUrl = this._buildCustomWhatsAppUrl(
      `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! I would like a quote for building a sports play area / court.`
    );

    const listHtml = SERVICES.map((svc) => {
      const waUrl = this._buildCustomWhatsAppUrl(
        `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! I'm interested in "${svc.name}". Please share quote & site visit details.`
      );
      return `
        <article class="pop-svc-card">
          <div class="pop-svc-top">
            <span class="pop-svc-badge">${svc.badge}</span>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="pop-svc-quote">Get Quote →</a>
          </div>
          <h3 class="pop-svc-title">${svc.name}</h3>
          <p class="pop-svc-sub">${svc.subtitle}</p>
        </article>
      `;
    }).join('');

    this.popoverBody.innerHTML = `
      ${listHtml}
      <a href="${customQuoteUrl}" target="_blank" rel="noopener noreferrer" class="pop-wa-btn">
        Discuss Custom Court / Turf Project on WhatsApp →
      </a>
    `;
  }

  _renderBagPopover(summary) {
    if (!this.popoverBody) return;
    const visitor = this.onboarding.getVisitor();
    const waUrl = this.cart.buildWhatsAppUrl(visitor);
    const hasUpi = Boolean(BRAND.upiId);

    if (summary.lines.length === 0) {
      this.popoverBody.innerHTML = `
        <div class="pop-empty">
          <strong>Your Kit Bag is empty</strong>
          <p>Swipe around the 3D shop and tap any sports item on the wall to add Retail or Wholesale packs.</p>
          <button type="button" class="pop-sec-btn" data-sample-bag="1">Load Sample Club Order</button>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="pop-wa-btn">Chat on WhatsApp →</a>
        </div>
      `;
      return;
    }

    const rowsHtml = summary.lines
      .map(
        (line) => `
          <div class="pop-bag-row">
            <div class="pop-bag-info">
              <div class="pop-item-name">${line.productName}</div>
              <div class="pop-item-sub">${line.packLabel} · ${formatInr(line.lineTotal)}</div>
            </div>
            <div class="obj-stepper">
              <button type="button" class="obj-step-btn" data-pid="${line.productId}" data-pack="${line.packIdx}" data-step="-1">−</button>
              <span class="obj-step-qty">${line.count}</span>
              <button type="button" class="obj-step-btn is-plus" data-pid="${line.productId}" data-pack="${line.packIdx}" data-step="1">+</button>
            </div>
          </div>
        `
      )
      .join('');

    this.popoverBody.innerHTML = `
      <div class="pop-bag-list">${rowsHtml}</div>
      <div class="pop-bag-total">
        <span>Total (${summary.totalUnits} pcs) <button type="button" class="pop-clear-btn" data-clear-bag="1">Clear</button></span>
        <strong>${formatInr(summary.totalAmount)}</strong>
      </div>
      ${
        hasUpi
          ? `<div class="pop-upi-box">
               <div id="fx-upi-qr" class="pop-upi-qr"></div>
               <div><strong>Scan &amp; Pay UPI</strong><div class="pop-item-sub">${BRAND.upiId}</div></div>
             </div>`
          : ''
      }
      <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="pop-wa-btn">Send Order on WhatsApp →</a>
      <button type="button" class="pop-sec-btn" data-copy-memo="1">Copy Order Memo</button>
    `;

    if (hasUpi) {
      const qrBox = this.popoverBody.querySelector('#fx-upi-qr');
      const uri = this.cart.buildUpiUri();
      if (qrBox && uri) {
        QRCode.toString(uri, { type: 'svg', margin: 1, width: 84 })
          .then((svg) => {
            qrBox.innerHTML = svg;
          })
          .catch(() => {});
      }
    }
  }

  _onCartUpdate(summary) {
    if (this.kitBagBtn) {
      this.kitBagBtn.textContent =
        summary.totalPacks > 0 ? `👜 ${summary.totalPacks} · ${formatInr(summary.totalAmount)}` : '👜 0';
    }

    // Update any visible steppers in-place so focus is preserved
    document.querySelectorAll('[data-qty-for]').forEach((el) => {
      const [pid, idxStr] = el.dataset.qtyFor.split('__');
      const qty = this.cart.getQty(pid, Number(idxStr));
      el.textContent = String(qty);
      el.closest('[data-pack-key]')?.classList.toggle('has-qty', qty > 0);
    });

    const footSummary = document.querySelector('[data-obj-bag-summary]');
    if (footSummary) {
      footSummary.textContent =
        summary.totalPacks > 0
          ? `In Bag: ${summary.totalPacks} packs · ${formatInr(summary.totalAmount)}`
          : 'Tap photo for gallery · Tap + to add';
    }

    if (this.popoverMode === 'bag' && !this.topPopover?.hidden) {
      this._renderBagPopover(summary);
    }
  }

  /* =========================================================
     SWIPEABLE 3D PHOTO STACK GALLERY
     ========================================================= */
  _bindPhotoStack() {
    this.stackCloseBtn?.addEventListener('click', () => this.closePhotoStack());
    this.stackPrevBtn?.addEventListener('click', () => this.stepPhotoStack(-1));
    this.stackNextBtn?.addEventListener('click', () => this.stepPhotoStack(1));

    this.stackModal?.addEventListener('click', (e) => {
      if (e.target === this.stackModal) this.closePhotoStack();
    });

    this.stackThumbs?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-stack-idx]');
      if (!btn) return;
      this.stackIndex = Number(btn.dataset.stackIdx);
      this._renderPhotoStackDeck();
    });

    window.addEventListener('keydown', (e) => {
      if (this.stackProduct && !this.stackModal?.hidden) {
        if (e.key === 'Escape') this.closePhotoStack();
        else if (e.key === 'ArrowRight') this.stepPhotoStack(1);
        else if (e.key === 'ArrowLeft') this.stepPhotoStack(-1);
        return;
      }
      if (e.key === 'Escape') {
        this.closeObjectPopup();
        this.closePopover();
      }
    });

    let dragStartX = null;
    let dragDx = 0;
    let activeCard = null;

    this.stackDeck?.addEventListener('pointerdown', (e) => {
      const topCard = this.stackDeck.querySelector('.stack-card[data-offset="0"]');
      if (!topCard) return;
      dragStartX = e.clientX;
      dragDx = 0;
      activeCard = topCard;
      activeCard.classList.add('is-dragging');
      this.stackDeck.setPointerCapture?.(e.pointerId);
    });

    this.stackDeck?.addEventListener('pointermove', (e) => {
      if (dragStartX === null || !activeCard) return;
      dragDx = e.clientX - dragStartX;
      const rot = Math.max(-14, Math.min(14, dragDx * 0.045));
      activeCard.style.transform = `translate3d(${dragDx}px, ${Math.abs(dragDx) * 0.05}px, 0) rotate(${rot}deg)`;
    });

    const finishDrag = () => {
      if (dragStartX === null || !activeCard) return;
      activeCard.classList.remove('is-dragging');
      const dx = dragDx;
      dragStartX = null;
      dragDx = 0;
      if (Math.abs(dx) > 55) {
        const dir = dx < 0 ? 1 : -1;
        activeCard.style.transform = `translate3d(${dx < 0 ? -340 : 340}px, 20px, 0) rotate(${dx < 0 ? -15 : 15}deg)`;
        activeCard.style.opacity = '0';
        const cardRef = activeCard;
        activeCard = null;
        window.setTimeout(() => {
          cardRef.style.transform = '';
          cardRef.style.opacity = '';
          this.stepPhotoStack(dir);
        }, 170);
      } else {
        activeCard.style.transform = '';
        activeCard = null;
      }
    };

    this.stackDeck?.addEventListener('pointerup', finishDrag);
    this.stackDeck?.addEventListener('pointercancel', finishDrag);
  }

  openPhotoStack(productId, initialIdx = 0) {
    const prod = PRODUCTS.find((p) => p.id === productId);
    if (!prod || !this.stackModal) return;
    this.stackProduct = prod;
    this.stackIndex = initialIdx;

    if (this.stackBadge) {
      this.stackBadge.textContent = `${prod.index} · ${prod.shortTab.toUpperCase()} · FROM ${formatInr(prod.retailPrice)}`;
    }
    if (this.stackTitle) {
      this.stackTitle.textContent = prod.name;
    }

    this._renderPhotoStackDeck();
    this.stackModal.hidden = false;
  }

  closePhotoStack() {
    if (!this.stackModal) return;
    this.stackModal.hidden = true;
    this.stackProduct = null;
  }

  stepPhotoStack(delta) {
    if (!this.stackProduct) return;
    const photos = this.stackProduct.gallery?.length
      ? this.stackProduct.gallery
      : [{ src: this.stackProduct.image, caption: this.stackProduct.name }];
    this.stackIndex = (this.stackIndex + delta + photos.length) % photos.length;
    this._renderPhotoStackDeck();
  }

  _renderPhotoStackDeck() {
    if (!this.stackProduct || !this.stackDeck) return;
    const photos = this.stackProduct.gallery?.length
      ? this.stackProduct.gallery
      : [{ src: this.stackProduct.image, caption: this.stackProduct.name }];
    const n = photos.length;

    this.stackDeck.innerHTML = photos
      .map((item, idx) => {
        const offset = (idx - this.stackIndex + n) % n;
        return `
          <figure class="stack-card" data-offset="${offset}">
            <img src="${item.src}" alt="${item.caption}" draggable="false" />
          </figure>
        `;
      })
      .join('');

    const current = photos[this.stackIndex];
    if (this.stackCaption) this.stackCaption.textContent = current.caption || this.stackProduct.name;
    if (this.stackCounter) this.stackCounter.textContent = `${this.stackIndex + 1} / ${n} · Swipe or tap arrows`;
    if (this.stackThumbs) {
      this.stackThumbs.innerHTML = photos
        .map(
          (item, idx) => `
            <button
              type="button"
              class="stack-thumb-btn ${idx === this.stackIndex ? 'is-active' : ''}"
              data-stack-idx="${idx}"
              aria-label="View photo ${idx + 1}"
            >
              <img src="${item.src}" alt="" />
            </button>
          `
        )
        .join('');
    }
  }
}
