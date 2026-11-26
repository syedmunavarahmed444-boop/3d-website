import QRCode from 'qrcode';
import { BRAND, PRODUCTS, SERVICES } from '../brand/storeData.js';

function formatInr(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Interactive 3D Showroom UX Controller (Branch: neon-new-ux)
 *
 * Flow:
 * 1. `onboarding` -> Generic Sign Up / Log In / Guest gate outside the closed shutter.
 * 2. `welcome`    -> Shutter automatically lifts + Mansoor waves + big "Step Inside" button.
 * 3. `inside`     -> Camera & Mansoor move inside by the counter; floating product & price list
 *                    pops up beside Mansoor; hovering or clicking any product glides the 3D shop
 *                    around in the background to showcase that exact rack.
 */
export class ShowroomUXController {
  constructor({ onboarding, cart, onStageChange }) {
    this.onboarding = onboarding;
    this.cart = cart;
    this.onStageChange = onStageChange;

    this.phase = 'onboarding'; // 'onboarding' | 'welcome' | 'inside'
    this.authTab = 'signup'; // 'signup' | 'login'
    this.insideTab = 'catalog'; // 'catalog' | 'services' | 'bag'
    this.searchQuery = '';
    this.selectedProductId = null;
    this.hoveredProductId = null;
    this._hoverTimer = null;

    // Swipeable photo stack gallery state
    this.stackProduct = null;
    this.stackIndex = 0;

    this._cacheElements();
    this._bindOnboarding();
    this._bindWelcome();
    this._bindTopbar();
    this._bindFloatingPanel();
    this._bindPhotoStack();

    this.cart.subscribe((summary) => this._onCartUpdate(summary));
    this._renderCatalogList();
    this._renderServicesList();

    // Always start on the onboarding gate unless the user just signed in this session
    this.setPhase('onboarding');
  }

  _cacheElements() {
    this.loader = document.getElementById('loader');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderPct = document.getElementById('loader-pct');

    this.topbar = document.getElementById('topbar');
    this.visitorBadge = document.getElementById('visitor-badge');
    this.signOutBtn = document.getElementById('signout-btn');
    this.kitBagBtn = document.getElementById('kitbag-open-btn');

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

    this.floatingPanel = document.getElementById('floating-catalog');
    this.panelTabCatalog = document.getElementById('panel-tab-catalog');
    this.panelTabServices = document.getElementById('panel-tab-services');
    this.panelTabBag = document.getElementById('panel-tab-bag');
    this.searchWrap = document.getElementById('catalog-search-wrap');
    this.searchInput = document.getElementById('catalog-search-input');
    this.searchClearBtn = document.getElementById('catalog-search-clear');
    this.panelSubtitle = document.getElementById('panel-subtitle');
    this.backToCounterBtn = document.getElementById('back-to-counter-btn');
    this.catalogScroll = document.getElementById('catalog-scroll-list');
    this.servicesScroll = document.getElementById('services-scroll-list');
    this.bagView = document.getElementById('bag-checkout-view');
    this.panelFooterSummary = document.getElementById('panel-footer-summary');
    this.panelWaBtn = document.getElementById('panel-wa-btn');

    this.liveSpotBadge = document.getElementById('live-spot-badge');

    // Photo stack modal elements
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
    window.setTimeout(() => {
      this.loader?.remove();
    }, 600);
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
    if (this.authNameField) {
      this.authNameField.hidden = !isSignup;
    }
    if (this.authSubmitBtn) {
      this.authSubmitBtn.textContent = isSignup ? 'Create Free Pass & Open Shutter →' : 'Sign In & Open Shutter →';
    }
  }

  _bindWelcome() {
    this.stepInsideBtn?.addEventListener('click', () => {
      this.setPhase('inside');
    });
  }

  _bindTopbar() {
    this.signOutBtn?.addEventListener('click', () => {
      this.onboarding.signOut();
      this.selectedProductId = null;
      this.hoveredProductId = null;
      this.insideTab = 'catalog';
      this.setPhase('onboarding');
    });

    this.kitBagBtn?.addEventListener('click', () => {
      if (this.phase !== 'inside') {
        if (!this.onboarding.getVisitor()) this.onboarding.continueAsGuest();
        this.setPhase('inside');
      }
      this._setInsideTab('bag');
    });
  }

  _bindFloatingPanel() {
    this.panelTabCatalog?.addEventListener('click', () => this._setInsideTab('catalog'));
    this.panelTabServices?.addEventListener('click', () => this._setInsideTab('services'));
    this.panelTabBag?.addEventListener('click', () => this._setInsideTab('bag'));

    // Live search across Products & Services
    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.trim();
      if (this.searchClearBtn) {
        this.searchClearBtn.hidden = !this.searchQuery;
      }
      if (this.insideTab === 'services') {
        this._renderServicesList();
      } else {
        if (this.insideTab !== 'catalog') this._setInsideTab('catalog');
        this._renderCatalogList();
      }
    });

    this.searchClearBtn?.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.focus();
      }
      this.searchQuery = '';
      if (this.searchClearBtn) this.searchClearBtn.hidden = true;
      this._renderCatalogList();
      this._renderServicesList();
    });

    this.backToCounterBtn?.addEventListener('click', () => {
      this.selectedProductId = null;
      this.hoveredProductId = null;
      this._syncCardStates();
      this._emitCameraForCurrentView();
    });

    // Click handler for photo stack, product selection & + / - steppers
    this.catalogScroll?.addEventListener('click', (e) => {
      const stackBtn = e.target.closest('button[data-open-stack]');
      if (stackBtn) {
        e.stopPropagation();
        const pid = stackBtn.dataset.openStack;
        this._focusProduct(pid, { lock: true });
        this.openPhotoStack(pid);
        return;
      }

      const stepBtn = e.target.closest('button[data-step]');
      if (stepBtn) {
        e.stopPropagation();
        const pid = stepBtn.dataset.pid;
        const packIdx = Number(stepBtn.dataset.pack);
        const delta = Number(stepBtn.dataset.step);
        this.cart.adjust(pid, packIdx, delta);
        this._focusProduct(pid, { lock: true });
        return;
      }

      const card = e.target.closest('.fx-prod-card');
      if (card) {
        const pid = card.dataset.pid;
        const willDeselect = this.selectedProductId === pid;
        this.selectedProductId = willDeselect ? null : pid;
        this._syncCardStates();
        this._emitCameraForCurrentView();
      }
    });

    // Hover handler: hovering any product row pans the 3D shop around in the background!
    this.catalogScroll?.addEventListener('pointerover', (e) => {
      const card = e.target.closest('.fx-prod-card');
      if (!card || this.insideTab !== 'catalog') return;
      const pid = card.dataset.pid;
      if (pid === this.hoveredProductId) return;
      this.hoveredProductId = pid;
      window.clearTimeout(this._hoverTimer);
      this._hoverTimer = window.setTimeout(() => {
        this._syncCardStates();
        this._emitCameraForCurrentView();
      }, 75);
    });

    this.catalogScroll?.addEventListener('pointerleave', () => {
      if (!this.hoveredProductId) return;
      this.hoveredProductId = null;
      window.clearTimeout(this._hoverTimer);
      this._syncCardStates();
      this._emitCameraForCurrentView();
    });

    // Bag view actions
    this.bagView?.addEventListener('click', (e) => {
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
          copyBtn.textContent = 'Copied Order Memo ✓';
          window.setTimeout(() => {
            copyBtn.textContent = 'Copy Order Memo';
          }, 1800);
        });
      }
    });
  }

  _focusProduct(pid, { lock = false } = {}) {
    if (lock) {
      this.selectedProductId = pid;
    } else {
      this.hoveredProductId = pid;
    }
    this._syncCardStates();
    this._emitCameraForCurrentView();
  }

  _setInsideTab(tab) {
    this.insideTab = tab;
    const isCatalog = tab === 'catalog';
    const isServices = tab === 'services';
    const isBag = tab === 'bag';

    this.panelTabCatalog?.classList.toggle('is-active', isCatalog);
    this.panelTabServices?.classList.toggle('is-active', isServices);
    this.panelTabBag?.classList.toggle('is-active', isBag);

    if (this.searchWrap) this.searchWrap.hidden = isBag;
    if (this.catalogScroll) this.catalogScroll.hidden = !isCatalog;
    if (this.servicesScroll) this.servicesScroll.hidden = !isServices;
    if (this.bagView) this.bagView.hidden = !isBag;

    if (this.panelSubtitle) {
      if (isServices) {
        this.panelSubtitle.textContent = 'Play areas, turf nets, courts & turnkey sports builds';
      } else if (isBag) {
        this.panelSubtitle.textContent = 'Review your Kit Bag & send straight to WhatsApp';
      } else {
        this.panelSubtitle.textContent = 'Hover or tap any item to view it in 3D';
      }
    }

    if (isServices) {
      this._renderServicesList();
    } else if (isBag) {
      this._renderBagView(this.cart.getSummary());
    } else {
      this._renderCatalogList();
    }
    this._emitCameraForCurrentView();
  }

  setPhase(nextPhase) {
    this.phase = nextPhase;
    const visitor = this.onboarding.getVisitor();

    if (this.onboardingGate) {
      this.onboardingGate.hidden = nextPhase !== 'onboarding';
    }
    if (this.welcomeHero) {
      this.welcomeHero.hidden = nextPhase !== 'welcome';
    }
    if (this.floatingPanel) {
      this.floatingPanel.hidden = nextPhase !== 'inside';
    }
    if (this.liveSpotBadge) {
      this.liveSpotBadge.hidden = nextPhase !== 'inside';
    }
    if (this.signOutBtn) {
      this.signOutBtn.hidden = nextPhase === 'onboarding';
    }
    if (this.visitorBadge) {
      if (visitor && nextPhase !== 'onboarding') {
        this.visitorBadge.hidden = false;
        this.visitorBadge.textContent = `Hi, ${visitor.name}`;
      } else {
        this.visitorBadge.hidden = true;
      }
    }
    if (this.welcomeGreeting && visitor) {
      const helloName = visitor.name === 'Guest' ? 'Welcome to Sultan Sports!' : `Welcome, ${visitor.name}!`;
      this.welcomeGreeting.textContent = helloName;
    }

    if (nextPhase === 'inside') {
      this._setInsideTab(this.insideTab);
    } else {
      this._emitCameraForCurrentView();
    }
  }

  _getActiveProduct() {
    const activeId = this.hoveredProductId || this.selectedProductId;
    if (!activeId) return null;
    return PRODUCTS.find((p) => p.id === activeId) || null;
  }

  _emitCameraForCurrentView() {
    if (this.phase === 'onboarding') {
      this.onStageChange?.({
        camPos: [0.55, 1.78, 9.8],
        camTarget: [0.65, 1.65, 1.35],
        shutterOpen: 0,
        mascot: { pos: [0.45, 0, 1.92], rotY: -0.06, anim: 'idle' },
      });
      return;
    }

    if (this.phase === 'welcome') {
      this.onStageChange?.({
        camPos: [0.28, 1.56, 5.4],
        camTarget: [0.18, 1.46, -1.85],
        shutterOpen: 1,
        mascot: { pos: [0.48, 0, 1.35], rotY: -0.1, anim: 'greet' },
      });
      return;
    }

    // Inside the shop!
    const activeProd = this.insideTab === 'catalog' ? this._getActiveProduct() : null;

    if (activeProd) {
      if (this.liveSpotBadge) {
        this.liveSpotBadge.textContent = `Viewing Shelf ${activeProd.index} · ${activeProd.name}`;
      }
      if (this.backToCounterBtn) {
        this.backToCounterBtn.hidden = false;
      }
      this.onStageChange?.({
        camPos: activeProd.focusCam.pos,
        camTarget: activeProd.focusCam.target,
        shutterOpen: 1,
        // Keep Mansoor gracefully beside the front-left counter or staged at the rack
        mascot: activeProd.mascot || { pos: [-0.52, 0, -0.82], rotY: 0.68, anim: 'point' },
      });
      return;
    }

    // Default inside view: Mansoor standing right beside the front-left glass counter!
    if (this.liveSpotBadge) {
      this.liveSpotBadge.textContent =
        this.insideTab === 'bag'
          ? 'Front-Left Billing Counter · Ready for WhatsApp Order'
          : 'Mansoor at Front-Left Counter · Hover or tap any product';
    }
    if (this.backToCounterBtn) {
      this.backToCounterBtn.hidden = true;
    }
    this.onStageChange?.({
      camPos: [1.12, 1.46, 0.92],
      camTarget: [-0.88, 0.94, -0.36],
      shutterOpen: 1,
      mascot: { pos: [-0.52, 0, -0.82], rotY: 0.68, anim: this.insideTab === 'bag' ? 'clap' : 'greet' },
    });
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

  _renderCatalogList() {
    if (!this.catalogScroll) return;
    const q = this.searchQuery.toLowerCase();
    const filtered = q
      ? PRODUCTS.filter((prod) => {
          const hay = [
            prod.name,
            prod.subtitle,
            prod.shortTab,
            prod.index,
            ...(prod.packs || []).map((p) => p.label),
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : PRODUCTS;

    if (filtered.length === 0) {
      const askUrl = this._buildCustomWhatsAppUrl(
        `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! I searched for "${this.searchQuery}" on your 3D Showroom. Do you have it in stock?`
      );
      this.catalogScroll.innerHTML = `
        <div class="fx-search-empty">
          <div class="fx-search-empty-title">We stock almost everything in sports!</div>
          <p class="fx-bag-hint">
            "<strong>${this.searchQuery}</strong>" isn't in our quick preview list yet, but we likely have it in-store or can source it wholesale.
          </p>
          <a href="${askUrl}" target="_blank" rel="noopener noreferrer" class="fx-wa-btn">
            Ask Mansoor for "${this.searchQuery}" on WhatsApp →
          </a>
        </div>
      `;
      return;
    }

    this.catalogScroll.innerHTML = filtered.map((prod) => {
      const packsHtml = prod.packs
        .map((pack, idx) => {
          const qty = this.cart.getQty(prod.id, idx);
          const key = this.cart.makeKey(prod.id, idx);
          return `
            <div class="fx-pack-row ${qty > 0 ? 'has-qty' : ''}" data-pack-key="${key}">
              <div class="fx-pack-info">
                <span class="fx-pack-label">${pack.label}</span>
                <span class="fx-pack-price">${formatInr(pack.price)}</span>
              </div>
              <div class="fx-stepper">
                <button type="button" class="fx-step-btn" data-pid="${prod.id}" data-pack="${idx}" data-step="-1" aria-label="Remove ${pack.label}">−</button>
                <span class="fx-step-qty" data-qty-for="${key}">${qty}</span>
                <button type="button" class="fx-step-btn is-plus" data-pid="${prod.id}" data-pack="${idx}" data-step="1" aria-label="Add ${pack.label}">+</button>
              </div>
            </div>
          `;
        })
        .join('');

      const galleryCount = (prod.gallery && prod.gallery.length) || 1;
      return `
        <article class="fx-prod-card" data-pid="${prod.id}">
          <div class="fx-prod-head">
            <div class="fx-prod-meta">
              <button
                type="button"
                class="fx-prod-thumb-wrap"
                data-open-stack="${prod.id}"
                aria-label="Open ${galleryCount} real photos of ${prod.name}"
                title="Tap to swipe ${galleryCount} real photos"
              >
                <img
                  src="${prod.image || `/products/${prod.id}.webp`}"
                  alt="${prod.name}"
                  class="fx-prod-thumb"
                  width="68"
                  height="68"
                  loading="lazy"
                />
                <span class="fx-prod-idx">${prod.index}</span>
                <span class="fx-stack-pill">⧉ ${galleryCount}</span>
              </button>
              <div class="fx-prod-text">
                <h3 class="fx-prod-title">${prod.name}</h3>
                <p class="fx-prod-sub">${prod.subtitle}</p>
                <div class="fx-prod-price-row">
                  <span class="fx-prod-price">From ${formatInr(prod.retailPrice)}</span>
                  <span class="fx-prod-cue">Tap photo · Hover 3D ↗</span>
                </div>
              </div>
            </div>
          </div>
          <div class="fx-pack-drawer">
            ${packsHtml}
          </div>
        </article>
      `;
    }).join('');
    this._syncCardStates();
  }

  _renderServicesList() {
    if (!this.servicesScroll) return;
    const q = this.searchQuery.toLowerCase();
    const filtered = q
      ? SERVICES.filter((svc) =>
          [svc.badge, svc.name, svc.subtitle, ...(svc.highlights || [])].join(' ').toLowerCase().includes(q)
        )
      : SERVICES;

    const customQuoteUrl = this._buildCustomWhatsAppUrl(
      `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! I would like a quote for a custom sports court / play area project.`
    );

    const cardsHtml = filtered
      .map((svc) => {
        const waUrl = this._buildCustomWhatsAppUrl(
          `Hello ${BRAND.whatsappGreetingName || BRAND.owner} (${BRAND.name})! I'm interested in your "${svc.name}" service. Please share details & site visit availability.`
        );
        const points = (svc.highlights || []).map((h) => `<li>${h}</li>`).join('');
        return `
          <article class="fx-service-card">
            <span class="fx-service-badge">${svc.badge}</span>
            <h3 class="fx-service-title">${svc.name}</h3>
            <p class="fx-service-sub">${svc.subtitle}</p>
            <ul class="fx-service-list">${points}</ul>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="fx-service-cta">
              Get Free Quote on WhatsApp →
            </a>
          </article>
        `;
      })
      .join('');

    this.servicesScroll.innerHTML =
      (cardsHtml ||
        `<div class="fx-search-empty">
          <div class="fx-search-empty-title">Custom Sports Infrastructure</div>
          <p class="fx-bag-hint">We build cricket nets, badminton &amp; volleyball courts, turf arenas, and school grounds across Kadapa &amp; AP.</p>
        </div>`) +
      `<div class="fx-service-banner">
        <strong>Planning a custom play area or academy?</strong>
        <span>Tell us your dimensions and sport—we handle netting, turf, flooring, poles &amp; lighting end-to-end.</span>
        <a href="${customQuoteUrl}" target="_blank" rel="noopener noreferrer" class="fx-wa-btn">
          Discuss Custom Project on WhatsApp →
        </a>
      </div>`;
  }

  _syncCardStates() {
    if (!this.catalogScroll) return;
    const activeId = this.hoveredProductId || this.selectedProductId;
    this.catalogScroll.querySelectorAll('.fx-prod-card').forEach((card) => {
      const pid = card.dataset.pid;
      card.classList.toggle('is-hovered', pid === activeId);
      card.classList.toggle('is-selected', pid === this.selectedProductId);
    });
  }

  _onCartUpdate(summary) {
    const visitor = this.onboarding.getVisitor();
    const waUrl = this.cart.buildWhatsAppUrl(visitor);

    if (this.kitBagBtn) {
      this.kitBagBtn.textContent =
        summary.totalPacks > 0
          ? `Kit Bag (${summary.totalPacks}) · ${formatInr(summary.totalAmount)}`
          : 'Kit Bag · 0';
      this.kitBagBtn.classList.toggle('has-items', summary.totalPacks > 0);
    }

    if (this.panelTabBag) {
      this.panelTabBag.textContent =
        summary.totalPacks > 0 ? `Kit Bag (${summary.totalPacks})` : 'Kit Bag (0)';
    }

    if (this.panelFooterSummary) {
      this.panelFooterSummary.textContent =
        summary.totalPacks > 0
          ? `${summary.totalPacks} packs (${summary.totalUnits} pcs) · ${formatInr(summary.totalAmount)}`
          : 'Tap + on any pack to build your order';
    }

    if (this.panelWaBtn) {
      this.panelWaBtn.href = waUrl;
    }

    // In-place DOM updates so + / - never steals keyboard focus
    document.querySelectorAll('[data-qty-for]').forEach((el) => {
      const [pid, idxStr] = el.dataset.qtyFor.split('__');
      const qty = this.cart.getQty(pid, Number(idxStr));
      el.textContent = String(qty);
      el.closest('[data-pack-key]')?.classList.toggle('has-qty', qty > 0);
    });

    if (this.insideTab === 'bag') {
      this._renderBagView(summary);
    }
  }

  _renderBagView(summary) {
    if (!this.bagView) return;
    const visitor = this.onboarding.getVisitor();
    const waUrl = this.cart.buildWhatsAppUrl(visitor);
    const hasUpi = Boolean(BRAND.upiId);

    if (summary.lines.length === 0) {
      this.bagView.innerHTML = `
        <div class="fx-bag-empty">
          <p>Your Kit Bag is empty right now.</p>
          <p class="fx-bag-hint">Switch to <strong>Products &amp; Prices</strong> to pick Retail or Wholesale packs, or load a sample Kadapa club order:</p>
          <button type="button" class="fx-secondary-btn" data-sample-bag="1">Load Sample Club Order</button>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="fx-wa-btn">Chat on WhatsApp →</a>
        </div>
      `;
      return;
    }

    const linesHtml = summary.lines
      .map(
        (line) => `
          <div class="fx-bag-line">
            <div>
              <div class="fx-bag-name">${line.productName}</div>
              <div class="fx-bag-sub">${line.packLabel} · ${formatInr(line.unitPrice)}</div>
            </div>
            <div class="fx-bag-right">
              <div class="fx-stepper">
                <button type="button" class="fx-step-btn" data-pid="${line.productId}" data-pack="${line.packIdx}" data-step="-1">−</button>
                <span class="fx-step-qty">${line.count}</span>
                <button type="button" class="fx-step-btn is-plus" data-pid="${line.productId}" data-pack="${line.packIdx}" data-step="1">+</button>
              </div>
              <span class="fx-bag-amt">${formatInr(line.lineTotal)}</span>
            </div>
          </div>
        `
      )
      .join('');

    this.bagView.innerHTML = `
      <div class="fx-bag-lines">${linesHtml}</div>
      <div class="fx-bag-total">
        <span>Total (${summary.totalUnits} pcs/sets) <button type="button" class="fx-clear-btn" data-clear-bag="1">Clear</button></span>
        <strong>${formatInr(summary.totalAmount)}</strong>
      </div>
      ${
        hasUpi
          ? `<div class="fx-upi-box">
               <div id="fx-upi-qr" class="fx-upi-qr"></div>
               <div>
                 <div class="fx-upi-title">Scan &amp; Pay via UPI</div>
                 <div class="fx-upi-id">${BRAND.upiId}</div>
               </div>
             </div>`
          : ''
      }
      <div class="fx-bag-actions">
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="fx-wa-btn">Send Order on WhatsApp →</a>
        <button type="button" class="fx-secondary-btn" data-copy-memo="1">Copy Order Memo</button>
      </div>
      <div class="fx-store-footer">
        <div><strong>${BRAND.name}</strong> · ${BRAND.hours}</div>
        <div>${BRAND.address}</div>
        <div class="fx-call-row">
          <a href="tel:+91${BRAND.phones[0].raw}">✆ ${BRAND.phones[0].display}</a>
          <a href="${BRAND.mapsQueryUrl}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
        </div>
      </div>
    `;

    if (hasUpi) {
      const qrBox = this.bagView.querySelector('#fx-upi-qr');
      const uri = this.cart.buildUpiUri();
      if (qrBox && uri) {
        QRCode.toString(uri, { type: 'svg', margin: 1, width: 92 })
          .then((svg) => {
            qrBox.innerHTML = svg;
          })
          .catch(() => {});
      }
    }
  }

  /* =========================================================
     SWIPEABLE PHOTO STACK GALLERY
     ========================================================= */
  _bindPhotoStack() {
    this.stackCloseBtn?.addEventListener('click', () => this.closePhotoStack());
    this.stackPrevBtn?.addEventListener('click', () => this.stepPhotoStack(-1));
    this.stackNextBtn?.addEventListener('click', () => this.stepPhotoStack(1));

    // Close on backdrop click
    this.stackModal?.addEventListener('click', (e) => {
      if (e.target === this.stackModal) this.closePhotoStack();
    });

    // Clickable bottom thumbnail strip
    this.stackThumbs?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-stack-idx]');
      if (!btn) return;
      this.stackIndex = Number(btn.dataset.stackIdx);
      this._renderPhotoStackDeck();
    });

    // Keyboard navigation while stack is open
    window.addEventListener('keydown', (e) => {
      if (!this.stackProduct || this.stackModal?.hidden) return;
      if (e.key === 'Escape') {
        this.closePhotoStack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepPhotoStack(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepPhotoStack(-1);
      }
    });

    // Touch & Mouse drag-to-swipe physics on the card deck
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
        activeCard.style.transform = `translate3d(${dx < 0 ? -360 : 360}px, 24px, 0) rotate(${dx < 0 ? -16 : 16}deg)`;
        activeCard.style.opacity = '0';
        const cardRef = activeCard;
        activeCard = null;
        window.setTimeout(() => {
          cardRef.style.transform = '';
          cardRef.style.opacity = '';
          this.stepPhotoStack(dir);
        }, 180);
      } else {
        activeCard.style.transform = '';
        activeCard = null;
      }
    };

    this.stackDeck?.addEventListener('pointerup', finishDrag);
    this.stackDeck?.addEventListener('pointercancel', finishDrag);
  }

  openPhotoStack(productId) {
    const prod = PRODUCTS.find((p) => p.id === productId);
    if (!prod || !this.stackModal) return;
    this.stackProduct = prod;
    this.stackIndex = 0;

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

    // Render layered 3D stack (front card offset=0, next behind offset=1, third offset=2)
    const cardsHtml = photos
      .map((item, idx) => {
        const offset = (idx - this.stackIndex + n) % n;
        const depth = Math.min(offset, 2);
        return `
          <figure class="stack-card" data-offset="${offset}" data-depth="${depth}">
            <img src="${item.src}" alt="${item.caption}" draggable="false" />
          </figure>
        `;
      })
      .join('');

    this.stackDeck.innerHTML = cardsHtml;

    const current = photos[this.stackIndex];
    if (this.stackCaption) {
      this.stackCaption.textContent = current.caption || this.stackProduct.name;
    }
    if (this.stackCounter) {
      this.stackCounter.textContent = `${this.stackIndex + 1} / ${n} · Swipe or tap arrows`;
    }
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
