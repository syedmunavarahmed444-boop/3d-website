import { BRAND, PRODUCTS } from '../brand/storeData.js';

const STORAGE_KEY = 'sultan_sports_kitbag_v1';

/**
 * Manages the interactive Retail & Wholesale Kit Bag across chapters,
 * persists selections locally, and formats the instant WhatsApp order memo.
 */
export class CartStore {
  constructor() {
    this.items = new Map();
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, qty]) => {
          const n = Number(qty);
          if (Number.isInteger(n) && n > 0) this.items.set(key, n);
        });
      }
    } catch {
      // Ignore storage errors in private browsing
    }
  }

  _save() {
    try {
      const obj = {};
      for (const [k, v] of this.items.entries()) {
        if (v > 0) obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage errors
    }
  }

  _notify() {
    this._save();
    const summary = this.getSummary();
    this.listeners.forEach((fn) => fn(summary));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getSummary());
    return () => this.listeners.delete(fn);
  }

  makeKey(productId, packIdx) {
    return `${productId}__${packIdx}`;
  }

  getQty(productId, packIdx) {
    return this.items.get(this.makeKey(productId, packIdx)) || 0;
  }

  adjust(productId, packIdx, delta) {
    const key = this.makeKey(productId, packIdx);
    const next = Math.max(0, (this.items.get(key) || 0) + delta);
    if (next === 0) {
      this.items.delete(key);
    } else {
      this.items.set(key, Math.min(99, next));
    }
    this._notify();
  }

  clear() {
    this.items.clear();
    this._notify();
  }

  loadSampleClubOrder() {
    this.items.clear();
    this.items.set(this.makeKey('willow-bats', 1), 1); // 6 Pcs Club Willow Bats
    this.items.set(this.makeKey('tennis-bats', 0), 2); // 2 M4 Scoop Bats
    this.items.set(this.makeKey('footballs', 1), 1); // 6 Balls Pack
    this.items.set(this.makeKey('trophies-carrom', 1), 1); // 10 Event Trophies
    this._notify();
  }

  getSummary() {
    const lines = [];
    let totalPacks = 0;
    let totalUnits = 0;
    let totalAmount = 0;

    PRODUCTS.forEach((prod) => {
      prod.packs.forEach((pack, packIdx) => {
        const count = this.getQty(prod.id, packIdx);
        if (count > 0) {
          const lineTotal = pack.price * count;
          totalPacks += count;
          totalUnits += pack.qty * count;
          totalAmount += lineTotal;
          lines.push({
            productId: prod.id,
            productName: prod.name,
            packIdx,
            packLabel: pack.label,
            unitPrice: pack.price,
            count,
            lineTotal,
          });
        }
      });
    });

    return { lines, totalPacks, totalUnits, totalAmount };
  }

  buildMemoText() {
    const { lines, totalPacks, totalUnits, totalAmount } = this.getSummary();
    if (lines.length === 0) {
      return `Hello Mansoor bhai (${BRAND.name})! I visited your 3D Showroom and would like to enquire about Retail & Wholesale sports gear prices.`;
    }

    const itemLines = lines
      .map(
        (l, i) =>
          `${i + 1}. ${l.productName} (${l.packLabel}) x ${l.count} = Rs.${l.lineTotal.toLocaleString('en-IN')}`
      )
      .join('\n');

    return [
      `Hello Mansoor bhai (${BRAND.name})!`,
      `Here is my Kit Bag order from your 3D Showroom:`,
      ``,
      itemLines,
      ``,
      `Total Packs: ${totalPacks} (${totalUnits} pcs/sets)`,
      `Estimated Total: Rs.${totalAmount.toLocaleString('en-IN')}`,
      `Please confirm availability & pickup at Apsara Circle, Kadapa.`,
    ].join('\n');
  }

  buildWhatsAppUrl() {
    const primaryPhone = BRAND.phones[0].raw;
    const text = encodeURIComponent(this.buildMemoText());
    return `https://wa.me/91${primaryPhone}?text=${text}`;
  }
}
