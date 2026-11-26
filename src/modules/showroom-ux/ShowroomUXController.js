import QRCode from 'qrcode';
import { BRAND, PRODUCTS } from '../brand/storeData.js';

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
    this.insideTab = 'catalog'; // 'catalog' | 'bag'
    this.selectedProductId = null;
    this.hoveredProductId = null;
    this._hoverTimer = null;

    this._cacheElements();
    this._bindOnboarding();
    this._bindWelcome();
    this._bindTopbar();
    this._bindFloatingPanel();

    this.cart.subscribe((summary) => this._onCartUpdate(summary));
    this._renderCatalogList();

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
    this.panelTabBag = document.getElementById('panel-tab-bag');
    this.panelSubtitle = document.getElementById('panel-subtitle');
    this.backToCounterBtn = document.getElementById('back-to-counter-btn');
    this.catalogScroll = document.getElementById('catalog-scroll-list');
    this.bagView = document.getElementById('bag-checkout-view');
    this.panelFooterSummary = document.getElementById('panel-footer-summary');
    this.panelWaBtn = document.getElementById('panel-wa-btn');

    this.liveSpotBadge = document.getElementById('live-spot-badge');
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
    this.panelTabBag?.addEventListener('click', () => this._setInsideTab('bag'));

    this.backToCounterBtn?.addEventListener('click', () => {
      this.selectedProductId = null;
      this.hoveredProductId = null;
      this._syncCardStates();
      this._emitCameraForCurrentView();
    });

    // Click handler for product selection & + / - steppers
    this.catalogScroll?.addEventListener('click', (e) => {
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
    this.panelTabCatalog?.classList.toggle('is-active', isCatalog);
    this.panelTabBag?.classList.toggle('is-active', !isCatalog);
    if (this.catalogScroll) this.catalogScroll.hidden = !isCatalog;
    if (this.bagView) this.bagView.hidden = isCatalog;
    if (!isCatalog) {
      this._renderBagView(this.cart.getSummary());
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

  _renderCatalogList() {
    if (!this.catalogScroll) return;
    this.catalogScroll.innerHTML = PRODUCTS.map((prod) => {
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

      return `
        <article class="fx-prod-card" data-pid="${prod.id}">
          <div class="fx-prod-head">
            <div class="fx-prod-meta">
              <div class="fx-prod-thumb-wrap">
                <img
                  src="${prod.image || `/products/${prod.id}.webp`}"
                  alt="${prod.name}"
                  class="fx-prod-thumb"
                  width="68"
                  height="68"
                  loading="lazy"
                />
                <span class="fx-prod-idx">${prod.index}</span>
              </div>
              <div class="fx-prod-text">
                <h3 class="fx-prod-title">${prod.name}</h3>
                <p class="fx-prod-sub">${prod.subtitle}</p>
                <div class="fx-prod-price-row">
                  <span class="fx-prod-price">From ${formatInr(prod.retailPrice)}</span>
                  <span class="fx-prod-cue">Hover / Tap ↗</span>
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
}
