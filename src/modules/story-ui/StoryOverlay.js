import { BRAND, CHAPTERS, PRODUCTS } from '../brand/storeData.js';

/**
 * Manages the Phase 1 overlay: loading screen, header, chapter timeline pills,
 * and the non-overlapping left-hand story card.
 */
export class StoryOverlay {
  constructor({ onJumpChapter }) {
    this.onJumpChapter = onJumpChapter;

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
    this.chapterNavEl = document.getElementById('chapter-nav');

    this._lastChapterId = null;
    this._lastProductIdx = -1;

    this._renderNav();
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

  setLoadProgress(pct) {
    if (this.loaderPctEl) this.loaderPctEl.textContent = `${pct}%`;
    if (this.loaderBarEl) this.loaderBarEl.style.width = `${pct}%`;
  }

  hideLoader() {
    this.loaderEl?.classList.add('is-hidden');
  }

  update(state) {
    const pct = Math.round(state.progress * 100);
    if (this.progressBarEl) this.progressBarEl.style.width = `${pct}%`;
    if (this.percentPillEl) this.percentPillEl.textContent = `${pct}%`;

    // Highlight active chapter pill
    this.chapterNavEl.querySelectorAll('.chapter-pill').forEach((btn, idx) => {
      btn.classList.toggle('is-active', idx === state.chapterIdx);
    });

    // Apply hold-then-travel fade
    this.cardEl.style.opacity = String(state.textOpacity);
    this.cardEl.style.pointerEvents = state.textOpacity > 0.35 ? 'auto' : 'none';
    this.cardEl.classList.toggle('is-solid', Boolean(state.chapter.solidPanel));

    // Only rebuild DOM text when chapter or active showcase product changes
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
    if (ch.showProductPreview) {
      const prod = PRODUCTS[productIdx];
      const wrap = document.createElement('div');
      wrap.className = 'product-preview';
      wrap.innerHTML = `
        <div class="product-preview-head">
          <span class="prod-tag">Rack ${prod.index} of 0${PRODUCTS.length}</span>
          <span class="prod-price">From ₹${prod.retailPrice.toLocaleString('en-IN')}</span>
        </div>
        <div class="prod-name">${prod.name}</div>
        <div class="prod-sub">${prod.subtitle}</div>
        <div class="prod-packs">
          ${prod.packs.map((pk) => `<span class="pack-chip">${pk.label} · ₹${pk.price.toLocaleString('en-IN')}</span>`).join('')}
        </div>
      `;
      this.extraEl.appendChild(wrap);
      return;
    }

    if (ch.showContactCard) {
      const wrap = document.createElement('div');
      wrap.className = 'visit-card';
      wrap.innerHTML = `
        <div class="visit-row"><strong>Address:</strong> ${BRAND.address}</div>
        <div class="visit-row"><strong>Hours:</strong> ${BRAND.hours}</div>
        <div class="visit-phones">
          ${BRAND.phones
            .map(
              (p) =>
                `<a class="visit-btn" href="tel:+91${p.raw}">${p.display}</a>`
            )
            .join('')}
          <a class="visit-btn is-gold" href="${BRAND.mapsQueryUrl}" target="_blank" rel="noopener noreferrer">Open Google Maps</a>
        </div>
      `;
      this.extraEl.appendChild(wrap);
    }
  }
}
