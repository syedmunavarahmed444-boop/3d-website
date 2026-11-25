const VISITOR_STORAGE_KEY = 'sultan_sports_visitor_v1';

/**
 * Modular Onboarding & Auth Store.
 * Currently uses a fast generic local session so the full 3D UX can be tested immediately.
 * Designed with a clean adapter boundary so Firebase Auth, AWS Cognito, or a custom
 * onboarding flow can be swapped in later without touching the 3D showroom or catalog.
 */
export class OnboardingStore {
  constructor() {
    this.visitor = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') return parsed;
    } catch {
      // Ignore private-mode storage errors
    }
    return null;
  }

  _save() {
    try {
      if (this.visitor) {
        localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(this.visitor));
      } else {
        localStorage.removeItem(VISITOR_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  _notify() {
    this._save();
    this.listeners.forEach((fn) => fn(this.visitor));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.visitor);
    return () => this.listeners.delete(fn);
  }

  getVisitor() {
    return this.visitor;
  }

  signUp({ name, phone }) {
    const cleanName = (name || '').trim() || 'Guest Player';
    const cleanPhone = (phone || '').replace(/[^\d+\s-]/g, '').trim();
    this.visitor = {
      name: cleanName,
      phone: cleanPhone,
      mode: 'signup',
      signedInAt: Date.now(),
    };
    this._notify();
    return this.visitor;
  }

  logIn({ phone, name }) {
    const cleanPhone = (phone || '').replace(/[^\d+\s-]/g, '').trim();
    const cleanName = (name || '').trim() || (cleanPhone ? `Player ${cleanPhone.slice(-4)}` : 'Returning Player');
    this.visitor = {
      name: cleanName,
      phone: cleanPhone,
      mode: 'login',
      signedInAt: Date.now(),
    };
    this._notify();
    return this.visitor;
  }

  continueAsGuest() {
    this.visitor = {
      name: 'Guest',
      phone: '',
      mode: 'guest',
      signedInAt: Date.now(),
    };
    this._notify();
    return this.visitor;
  }

  signOut() {
    this.visitor = null;
    this._notify();
  }
}
