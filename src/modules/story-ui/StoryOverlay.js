import { BRAND, CHAPTERS, PRODUCTS } from '../brand/storeData.js';
import { CartStore } from '../cart/CartStore.js';

/**
 * Manages the full showroom UI overlay: loading screen, topbar Kit Bag pill,
 * interactive Retail & Wholesale rack selector, Chapter 7 WhatsApp order bill,
 * and non-blocking bottom-left story card.
 */
export class StoryOverlay {
  constructor({ onJumpChapter }) {
    this.onJumpChapter = onJumpChapter;
    this.cart = new CartStore();

    this.loaderEl = document.getElementById('loader');
    this.loaderPctEl = document.getElementById('loader-pct');
    this.loaderBarEl = document.getElementById('loader-bar');

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

    this._lastChapterId = null;
    this._lastProductIdx = -1;
    this._currentState = null;

    this._renderNav();
    this._bindTopbarBag();
    this.cart.subscribe((summary) => this._onCartChange(summary));
  }

  _bindTopbarBag() {
    this.kitbagBtnEl?.addEventListener('click', () => {
      const billCh = CHAPTERS.find((c) => c.id === 'bill');
      if (billCh) {
        const mid = (billCh.textWindow[0] + billCh.textWindow[1]) * 0.5;
        this.onJumpChapter?.(mid);
      }
    });
  }

  _onCartChange(summary) {
    if (this.kitbagBtnEl) {
      if (summary.totalPacks > 0) {
        this.kitbagBtnEl.textContent = `Kit Bag (${summary.totalPacks}) · ₹${summary.totalAmount.toLocaleString('en-IN')}`;
        this.kitbagBtnEl.classList.add('has-items');
      } else {
        this.kitbagBtnEl.textContent = 'Kit Bag · 0';
        this.kitbagBtnEl.classList.remove('has-items');
      }
    }

    // Refresh active card controls when inside Racks or Bill chapters
    if (this._currentState) {
      const ch = this._currentState.chapter;
      if (ch.showProductPreview || ch.id === 'bill') {
        this._renderExtra(ch, this._currentState.activeProductIdx);
      }
    }
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
      });
      this.chapterNavEl.appendChild(btn);
    });
  }

  _jumpToProductStop(prodIdx) {
    const ch = CHAPTERS[2]; // showcase chapter
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

    this.chapterNavEl.querySelectorAll('.chapter-pill').forEach((btn, idx) => {
      btn.classList.toggle('is-active', idx === state.chapterIdx);
    });

    this.cardEl.style.opacity = String(state.textOpacity);
    this.cardEl.style.pointerEvents = state.textOpacity > 0.35 ? 'auto' : 'none';
    this.cardEl.classList.toggle('is-solid', Boolean(state.chapter.solidPanel));

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

    // Chapter 3: Interactive 7-Rack Switcher + Retail/Wholesale Pack Adders
    if (ch.showProductPreview) {
      const prod = PRODUCTS[productIdx];
      const wrap = document.createElement('div');
      wrap.className = 'product-preview';

      const tabsHtml = PRODUCTS.map(
        (p, idx) =>
          `<button type="button" class="rack-tab ${idx === productIdx ? 'is-active' : ''}" data-rack-idx="${idx}">${p.index}</button>`
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
                <span class="step-qty">${qty}</span>
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
        ${
          summary.totalPacks > 0
            ? `<button type="button" class="goto-bill-btn">Review Kit Bag (${summary.totalPacks} packs · ₹${summary.totalAmount.toLocaleString('en-IN')}) →</button>`
            : ''
        }
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

    // Chapter 7: Itemized Order Memo, Demo UPI QR & Instant WhatsApp Checkout
    if (ch.id === 'bill') {
      const summary = this.cart.getSummary();
      const wrap = document.createElement('div');
      wrap.className = 'bill-memo';

      const isDemoQr = !BRAND.upiId;
      const qrCells = Array.from({ length: 49 })
        .map((_, i) => {
          const dark = [0, 1, 2, 4, 5, 6, 7, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 35, 41, 42, 43, 44, 46, 47, 48].includes(i);
          return `<span class="${dark ? 'q-on' : 'q-off'}"></span>`;
        })
        .join('');

      if (summary.lines.length === 0) {
        wrap.innerHTML = `
          <div class="bill-empty">
            <div class="bill-empty-text">No packs added yet—pick items on the Racks or try a sample club kit:</div>
            <div class="bill-empty-actions">
              <button type="button" class="bill-action-btn is-gold" id="sample-kit-btn">+ Load Sample Club Order</button>
              <button type="button" class="bill-action-btn" id="back-racks-btn">Browse 7 Racks</button>
            </div>
          </div>
          <div class="bill-qr-strip">
            <div class="qr-mini" aria-label="UPI QR Preview">
              <div class="qr-grid">${qrCells}</div>
              ${isDemoQr ? '<span class="qr-demo-badge">DEMO</span>' : ''}
            </div>
            <div class="qr-info">
              <div class="qr-title">${isDemoQr ? 'Demo Storefront QR' : `Pay via UPI: ${BRAND.upiId}`}</div>
              <div class="qr-sub">Send your list on WhatsApp for instant wholesale confirmation &amp; pickup.</div>
              <a class="wa-checkout-btn" href="${this.cart.buildWhatsAppUrl()}" target="_blank" rel="noopener noreferrer">
                Enquire on WhatsApp
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
                  <button type="button" class="step-btn" data-pid="${l.productId}" data-pidx="${l.packIdx}" data-act="dec">−</button>
                  <span class="step-qty">${l.count}</span>
                  <button type="button" class="step-btn is-plus" data-pid="${l.productId}" data-pidx="${l.packIdx}" data-act="inc">+</button>
                </div>
                <div class="memo-line-total">₹${l.lineTotal.toLocaleString('en-IN')}</div>
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
            <div class="qr-mini" aria-label="UPI QR Preview">
              <div class="qr-grid">${qrCells}</div>
              ${isDemoQr ? '<span class="qr-demo-badge">DEMO</span>' : ''}
            </div>
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
