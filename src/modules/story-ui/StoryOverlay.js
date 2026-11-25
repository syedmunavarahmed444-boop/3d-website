import QRCode from 'qrcode';
import { BRAND, CHAPTERS, PRODUCTS } from '../brand/storeData.js';
import { CartStore } from '../cart/CartStore.js';

/**
 * Manages the full showroom UI overlay:
 * - Focus-preserving +/- Kit Bag updates (no DOM destruction on click!)
 * - Real scannable UPI QR generation ONLY when BRAND.upiId is configured (hidden when empty)
 * - Classic View fast-scrolling catalog sheet (pauses 3D rendering while open)
 * - Prev/Next chapter dock arrows & mobile floating Call button
 */
export class StoryOverlay {
  constructor({ onJumpChapter, onStepChapter, onToggleClassic }) {
    this.onJumpChapter = onJumpChapter;
    this.onStepChapter = onStepChapter;
    this.onToggleClassic = onToggleClassic;
    this.cart = new CartStore();
    this.isClassicOpen = false;

    this.loaderEl = document.getElementById('loader');
    this.loaderPctEl = document.getElementById('loader-pct');
    this.loaderBarEl = document.getElementById('loader-bar');
    this.announcerEl = document.getElementById('sr-announcer');

    this.cardEl = document.getElementById('story-card');
    this.numEl = document.getElementById('card-num');
    this.titleEl = document.getElementById('card-title');
    this.bodyEl = document.getElementById('card-body');
    this.extraEl = document.getElementById('card-extra');
    this.ctaEl = document.getElementById('card-cta');

    this.progressBarEl = document.getElementById('scroll-progress-bar');
    this.percentPillEl = document.getElementById('scroll-pct');
    this.kitbagBtnEl = document.getElementById('kitbag-jump-btn');
    this.chapterNavEl = document.getElementById('chapter-nav');
    this.prevBtnEl = document.getElementById('chapter-prev-btn');
    this.nextBtnEl = document.getElementById('chapter-next-btn');
    this.mobileCallEl = document.getElementById('mobile-call-fab');

    this.classicModalEl = document.getElementById('classic-modal');
    this.classicOpenBtn = document.getElementById('classic-open-btn');
    this.classicCloseBtn = document.getElementById('classic-close-btn');
    this.classicGridEl = document.getElementById('classic-catalog-grid');
    this.classicSummaryEl = document.getElementById('classic-bag-summary');
    this.classicWaBtnEl = document.getElementById('classic-wa-btn');

    this._lastChapterId = null;
    this._lastProductIdx = -1;
    this._lastNavIdx = -1;
    this._currentState = null;
    this._lastBillLineSignature = '';

    if (this.mobileCallEl && BRAND.phones[0]) {
      this.mobileCallEl.href = `tel:+91${BRAND.phones[0].raw}`;
    }

    this._renderNav();
    this._renderClassicCatalog();
    this._bindControls();
    this.cart.subscribe((summary) => this._onCartChange(summary));
  }

  _bindControls() {
    this.kitbagBtnEl?.addEventListener('click', () => {
      if (this.isClassicOpen) this.setClassicOpen(false);
      const billCh = CHAPTERS.find((c) => c.id === 'bill');
      if (billCh) {
        const mid = (billCh.textWindow[0] + billCh.textWindow[1]) * 0.5;
        this.onJumpChapter?.(mid);
      }
    });

    this.prevBtnEl?.addEventListener('click', () => this.onStepChapter?.(-1));
    this.nextBtnEl?.addEventListener('click', () => this.onStepChapter?.(1));

    this.classicOpenBtn?.addEventListener('click', () => this.setClassicOpen(true));
    this.classicCloseBtn?.addEventListener('click', () => this.setClassicOpen(false));
    this.classicModalEl?.addEventListener('click', (e) => {
      if (e.target === this.classicModalEl) this.setClassicOpen(false);
    });
  }

  setClassicOpen(open) {
    this.isClassicOpen = Boolean(open);
    if (this.classicModalEl) {
      this.classicModalEl.hidden = !this.isClassicOpen;
    }
    this.onToggleClassic?.(this.isClassicOpen);
    if (this.isClassicOpen) {
      this.classicCloseBtn?.focus();
    } else {
      this.classicOpenBtn?.focus();
    }
  }

  _renderClassicCatalog() {
    if (!this.classicGridEl) return;
    this.classicGridEl.innerHTML = PRODUCTS.map(
      (prod) => `
      <article class="classic-item" data-classic-prod="${prod.id}">
        <div class="classic-item-head">
          <span class="prod-tag">${prod.index} · ${prod.shortTab}</span>
          <span class="prod-price">From ₹${prod.retailPrice.toLocaleString('en-IN')}</span>
        </div>
        <h3>${prod.name}</h3>
        <p class="classic-sub">${prod.subtitle}</p>
        <div class="prod-packs-interactive">
          ${prod.packs
            .map((pk, pkIdx) => {
              const qty = this.cart.getQty(prod.id, pkIdx);
              return `
                <div class="pack-row ${qty > 0 ? 'is-selected' : ''}" data-key="${prod.id}__${pkIdx}">
                  <div class="pack-meta">
                    <span class="pack-label">${pk.label}</span>
                    <span class="pack-price">₹${pk.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div class="pack-stepper">
                    <button type="button" class="step-btn" data-pid="${prod.id}" data-pack="${pkIdx}" data-act="dec" aria-label="Decrease ${prod.name} ${pk.label}">−</button>
                    <span class="step-qty" data-qty-for="${prod.id}__${pkIdx}">${qty}</span>
                    <button type="button" class="step-btn is-plus" data-pid="${prod.id}" data-pack="${pkIdx}" data-act="inc" aria-label="Add ${prod.name} ${pk.label}">+</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </article>
    `
    ).join('');

    this.classicGridEl.querySelectorAll('.step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cart.adjust(btn.dataset.pid, Number(btn.dataset.pack), btn.dataset.act === 'inc' ? 1 : -1);
      });
    });
  }

  _onCartChange(summary) {
    // 1. Update Topbar Kit Bag Pill
    if (this.kitbagBtnEl) {
      if (summary.totalPacks > 0) {
        this.kitbagBtnEl.textContent = `Kit Bag (${summary.totalPacks}) · ₹${summary.totalAmount.toLocaleString('en-IN')}`;
        this.kitbagBtnEl.classList.add('has-items');
      } else {
        this.kitbagBtnEl.textContent = 'Kit Bag · 0';
        this.kitbagBtnEl.classList.remove('has-items');
      }
    }

    // 2. Update Classic View summary & in-place quantities without losing focus
    if (this.classicSummaryEl) {
      this.classicSummaryEl.textContent =
        summary.totalPacks > 0
          ? `Kit Bag: ${summary.totalPacks} packs (${summary.totalUnits} pcs) · ₹${summary.totalAmount.toLocaleString('en-IN')}`
          : 'Kit Bag: 0 packs (tap + on any item above)';
    }
    if (this.classicWaBtnEl) {
      this.classicWaBtnEl.href = this.cart.buildWhatsAppUrl();
    }

    document.querySelectorAll('[data-qty-for]').forEach((qtyEl) => {
      const [pid, pkIdxStr] = qtyEl.dataset.qtyFor.split('__');
      const q = this.cart.getQty(pid, Number(pkIdxStr));
      qtyEl.textContent = String(q);
      qtyEl.closest('.pack-row')?.classList.toggle('is-selected', q > 0);
    });

    // 3. In-place focus-safe updates inside Story Card
    if (!this._currentState) return;
    const ch = this._currentState.chapter;

    if (ch.showProductPreview) {
      const gotoBtn = this.extraEl.querySelector('.goto-bill-btn');
      if (summary.totalPacks > 0) {
        const label = `Review Kit Bag (${summary.totalPacks} packs · ₹${summary.totalAmount.toLocaleString('en-IN')}) →`;
        if (gotoBtn) {
          gotoBtn.textContent = label;
          gotoBtn.hidden = false;
        }
      } else if (gotoBtn) {
        gotoBtn.hidden = true;
      }
    } else if (ch.id === 'bill') {
      const sig = summary.lines.map((l) => `${l.productId}:${l.packIdx}`).join('|');
      if (sig !== this._lastBillLineSignature) {
        // Line items added/removed — rebuild Bill section
        this._renderExtra(ch, this._currentState.activeProductIdx);
      } else {
        // Same line items — update numbers, totals & WhatsApp link in-place so +/- keeps focus!
        summary.lines.forEach((l) => {
          const lineTotalEl = this.extraEl.querySelector(`[data-line-total="${l.productId}__${l.packIdx}"]`);
          if (lineTotalEl) lineTotalEl.textContent = `₹${l.lineTotal.toLocaleString('en-IN')}`;
        });
        const unitLbl = this.extraEl.querySelector('.memo-total-label');
        if (unitLbl) unitLbl.textContent = `Total (${summary.totalUnits} pcs/sets)`;
        const grandEl = this.extraEl.querySelector('.memo-grand-total');
        if (grandEl) grandEl.textContent = `₹${summary.totalAmount.toLocaleString('en-IN')}`;
        const waEl = this.extraEl.querySelector('.wa-checkout-btn');
        if (waEl) waEl.href = this.cart.buildWhatsAppUrl();
        this._refreshRealUpiQr();
      }
    }
  }

  _refreshRealUpiQr() {
    const slot = this.extraEl.querySelector('#real-upi-qr-slot');
    if (!slot || !BRAND.upiId) return;
    const uri = this.cart.buildUpiUri();
    QRCode.toString(uri, { type: 'svg', margin: 1, width: 72 }, (err, svg) => {
      if (!err && svg) slot.innerHTML = svg;
    });
  }

  _renderNav() {
    this.chapterNavEl.innerHTML = '';
    CHAPTERS.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chapter-pill';
      btn.textContent = ch.label;
      btn.dataset.idx = String(idx);
      btn.addEventListener('click', () => {
        const mid = (ch.textWindow[0] + ch.textWindow[1]) * 0.5;
        this.onJumpChapter?.(idx === 0 ? 0 : mid);
        if (this.announcerEl) {
          this.announcerEl.textContent = `${ch.num}: ${ch.title}`;
        }
      });
      this.chapterNavEl.appendChild(btn);
    });
  }

  _jumpToProductStop(prodIdx) {
    const ch = CHAPTERS[2];
    const [tw0, tw1] = ch.textWindow;
    const slice = (tw1 - tw0) / PRODUCTS.length;
    const targetP = tw0 + (prodIdx + 0.32) * slice;
    this.onJumpChapter?.(targetP);
  }

  setLoadProgress(pct) {
    if (this.loaderPctEl) this.loaderPctEl.textContent = `${pct}%`;
    if (this.loaderBarEl) this.loaderBarEl.style.width = `${pct}%`;
  }

  hideLoader() {
    this.loaderEl?.classList.add('is-hidden');
  }

  update(state) {
    this._currentState = state;
    const pct = Math.round(state.progress * 100);
    if (this.progressBarEl) this.progressBarEl.style.width = `${pct}%`;
    if (this.percentPillEl) this.percentPillEl.textContent = `${pct}%`;

    if (this.prevBtnEl) this.prevBtnEl.disabled = state.chapterIdx === 0;
    if (this.nextBtnEl) this.nextBtnEl.disabled = state.chapterIdx === CHAPTERS.length - 1;

    this.chapterNavEl.querySelectorAll('.chapter-pill').forEach((btn, idx) => {
      const active = idx === state.chapterIdx;
      btn.classList.toggle('is-active', active);
      if (active && this._lastNavIdx !== state.chapterIdx) {
        this._lastNavIdx = state.chapterIdx;
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });

    const isInteractive = Boolean(state.chapter.showProductPreview || state.chapter.id === 'bill');
    this.cardEl.style.opacity = String(state.textOpacity);
    this.cardEl.style.pointerEvents = state.textOpacity > 0.35 ? 'auto' : 'none';
    this.cardEl.classList.toggle('is-solid', Boolean(state.chapter.solidPanel));
    this.cardEl.classList.toggle('has-interactive', isInteractive);

    if (
      this._lastChapterId !== state.chapter.id ||
      (state.chapter.showProductPreview && this._lastProductIdx !== state.activeProductIdx)
    ) {
      this._lastChapterId = state.chapter.id;
      this._lastProductIdx = state.activeProductIdx;

      const ch = state.chapter;
      this.numEl.textContent = ch.num;
      this.titleEl.textContent = ch.title;
      this.bodyEl.textContent = ch.body;
      this.ctaEl.textContent = ch.cta || '';
      this.ctaEl.hidden = !ch.cta;

      this._renderExtra(ch, state.activeProductIdx);
    }
  }

  _renderExtra(ch, productIdx) {
    this.extraEl.innerHTML = '';

    // Chapter 3: Interactive 7-Rack Switcher + Focus-Safe Steppers
    if (ch.showProductPreview) {
      const prod = PRODUCTS[productIdx];
      const wrap = document.createElement('div');
      wrap.className = 'product-preview';

      const tabsHtml = PRODUCTS.map(
        (p, idx) =>
          `<button type="button" class="rack-tab ${idx === productIdx ? 'is-active' : ''}" data-rack-idx="${idx}">
            <span class="rt-num">${p.index}</span>
            <span class="rt-lbl">${p.shortTab || ''}</span>
          </button>`
      ).join('');

      const packsHtml = prod.packs
        .map((pk, pkIdx) => {
          const qty = this.cart.getQty(prod.id, pkIdx);
          return `
            <div class="pack-row ${qty > 0 ? 'is-selected' : ''}">
              <div class="pack-meta">
                <span class="pack-label">${pk.label}</span>
                <span class="pack-price">₹${pk.price.toLocaleString('en-IN')}</span>
              </div>
              <div class="pack-stepper">
                <button type="button" class="step-btn" data-act="dec" data-pack="${pkIdx}" aria-label="Remove ${pk.label}">−</button>
                <span class="step-qty" data-qty-for="${prod.id}__${pkIdx}">${qty}</span>
                <button type="button" class="step-btn is-plus" data-act="inc" data-pack="${pkIdx}" aria-label="Add ${pk.label}">+</button>
              </div>
            </div>
          `;
        })
        .join('');

      const summary = this.cart.getSummary();
      wrap.innerHTML = `
        <div class="rack-tabs" role="tablist" aria-label="Product Racks">${tabsHtml}</div>
        <div class="product-preview-head">
          <span class="prod-tag">Rack ${prod.index} of 0${PRODUCTS.length}</span>
          <span class="prod-price">From ₹${prod.retailPrice.toLocaleString('en-IN')}</span>
        </div>
        <div class="prod-name">${prod.name}</div>
        <div class="prod-sub">${prod.subtitle}</div>
        <div class="prod-packs-interactive">${packsHtml}</div>
        <button type="button" class="goto-bill-btn" ${summary.totalPacks > 0 ? '' : 'hidden'}>
          Review Kit Bag (${summary.totalPacks} packs · ₹${summary.totalAmount.toLocaleString('en-IN')}) →
        </button>
      `;

      wrap.querySelectorAll('.rack-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._jumpToProductStop(Number(btn.dataset.rackIdx));
        });
      });

      wrap.querySelectorAll('.step-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pkIdx = Number(btn.dataset.pack);
          const delta = btn.dataset.act === 'inc' ? 1 : -1;
          this.cart.adjust(prod.id, pkIdx, delta);
        });
      });

      wrap.querySelector('.goto-bill-btn')?.addEventListener('click', () => {
        const billCh = CHAPTERS.find((c) => c.id === 'bill');
        if (billCh) this.onJumpChapter?.((billCh.textWindow[0] + billCh.textWindow[1]) * 0.5);
      });

      this.extraEl.appendChild(wrap);
      return;
    }

    // Chapter 7: Itemized Order Memo + WhatsApp Checkout (+ Real UPI QR ONLY if BRAND.upiId is configured!)
    if (ch.id === 'bill') {
      const summary = this.cart.getSummary();
      this._lastBillLineSignature = summary.lines.map((l) => `${l.productId}:${l.packIdx}`).join('|');

      const wrap = document.createElement('div');
      wrap.className = 'bill-memo';

      const upiBlockHtml = BRAND.upiId
        ? `<div class="qr-mini" id="real-upi-qr-slot" aria-label="Scan to pay via UPI"></div>`
        : '';

      if (summary.lines.length === 0) {
        wrap.innerHTML = `
          <div class="bill-empty">
            <div class="bill-empty-text">No packs selected yet—tap + on any rack or load a sample club kit:</div>
            <div class="bill-empty-actions">
              <button type="button" class="bill-action-btn is-gold" id="sample-kit-btn">+ Sample Club Order</button>
              <button type="button" class="bill-action-btn" id="back-racks-btn">Browse 7 Racks</button>
            </div>
          </div>
          <div class="bill-qr-strip">
            ${upiBlockHtml}
            <div class="qr-info">
              <div class="qr-title">${BRAND.upiId ? `UPI ID: ${BRAND.upiId}` : 'Instant WhatsApp & Counter Pickup'}</div>
              <div class="qr-sub">Send your order list straight to ${BRAND.whatsappGreetingName} for wholesale confirmation.</div>
              <a class="wa-checkout-btn" href="${this.cart.buildWhatsAppUrl()}" target="_blank" rel="noopener noreferrer">
                Enquire on WhatsApp →
              </a>
            </div>
          </div>
        `;
        wrap.querySelector('#sample-kit-btn')?.addEventListener('click', () => {
          this.cart.loadSampleClubOrder();
        });
        wrap.querySelector('#back-racks-btn')?.addEventListener('click', () => {
          this._jumpToProductStop(0);
        });
      } else {
        const rowsHtml = summary.lines
          .map(
            (l) => `
            <div class="memo-line">
              <div class="memo-line-info">
                <div class="memo-item-name">${l.productName}</div>
                <div class="memo-item-pack">${l.packLabel} · ₹${l.unitPrice.toLocaleString('en-IN')}</div>
              </div>
              <div class="memo-line-right">
                <div class="pack-stepper is-compact">
                  <button type="button" class="step-btn" data-pid="${l.productId}" data-pidx="${l.packIdx}" data-act="dec" aria-label="Decrease ${l.productName}">−</button>
                  <span class="step-qty" data-qty-for="${l.productId}__${l.packIdx}">${l.count}</span>
                  <button type="button" class="step-btn is-plus" data-pid="${l.productId}" data-pidx="${l.packIdx}" data-act="inc" aria-label="Increase ${l.productName}">+</button>
                </div>
                <div class="memo-line-total" data-line-total="${l.productId}__${l.packIdx}">₹${l.lineTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>
          `
          )
          .join('');

        wrap.innerHTML = `
          <div class="memo-list">${rowsHtml}</div>
          <div class="memo-footer-totals">
            <div>
              <span class="memo-total-label">Total (${summary.totalUnits} pcs/sets)</span>
              <button type="button" class="memo-clear-btn" id="clear-bag-btn">Clear</button>
            </div>
            <span class="memo-grand-total">₹${summary.totalAmount.toLocaleString('en-IN')}</span>
          </div>
          <div class="bill-qr-strip">
            ${upiBlockHtml}
            <div class="qr-info">
              <a class="wa-checkout-btn" href="${this.cart.buildWhatsAppUrl()}" target="_blank" rel="noopener noreferrer">
                Send Order on WhatsApp →
              </a>
              <button type="button" class="copy-memo-btn" id="copy-memo-btn">Copy Order Memo</button>
            </div>
          </div>
        `;

        wrap.querySelectorAll('.step-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.cart.adjust(
              btn.dataset.pid,
              Number(btn.dataset.pidx),
              btn.dataset.act === 'inc' ? 1 : -1
            );
          });
        });

        wrap.querySelector('#clear-bag-btn')?.addEventListener('click', () => {
          this.cart.clear();
        });

        wrap.querySelector('#copy-memo-btn')?.addEventListener('click', (e) => {
          const btn = e.currentTarget;
          navigator.clipboard?.writeText(this.cart.buildMemoText()).then(() => {
            btn.textContent = 'Copied to Clipboard ✓';
            setTimeout(() => {
              btn.textContent = 'Copy Order Memo';
            }, 1800);
          });
        });
      }

      this.extraEl.appendChild(wrap);
      this._refreshRealUpiQr();
      return;
    }

    // Chapter 8: Visit & Direct Store Contact Card
    if (ch.showContactCard) {
      const wrap = document.createElement('div');
      wrap.className = 'visit-card';
      wrap.innerHTML = `
        <div class="visit-row"><strong>Address:</strong> ${BRAND.address}</div>
        <div class="visit-row"><strong>Hours:</strong> ${BRAND.hours} · <strong>Instagram:</strong> ${BRAND.instagram}</div>
        <div class="visit-phones">
          ${BRAND.phones
            .map((p) => `<a class="visit-btn" href="tel:+91${p.raw}">${p.display}</a>`)
            .join('')}
          <a class="visit-btn is-gold" href="${BRAND.mapsQueryUrl}" target="_blank" rel="noopener noreferrer">Open Google Maps</a>
        </div>
      `;
      this.extraEl.appendChild(wrap);
    }
  }
}
