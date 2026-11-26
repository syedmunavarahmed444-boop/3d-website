import { CognitoAuthClient } from './CognitoAuthClient.js';

const VISITOR_STORAGE_KEY = 'sultan_sports_visitor_v2';

/**
 * Modular Onboarding & Authentication Store backed by real Amazon Cognito
 * (Passwordless 6-Digit Email OTP + OAuth 2.0 Authorization Code PKCE + Guest Browse).
 */
export class OnboardingStore {
  constructor() {
    this.cognito = new CognitoAuthClient();
    this.visitor = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = sessionStorage.getItem(VISITOR_STORAGE_KEY);
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
        sessionStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(this.visitor));
      } else {
        sessionStorage.removeItem(VISITOR_STORAGE_KEY);
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

  isGoogleOAuthEnabled() {
    return this.cognito.isGoogleEnabled();
  }

  async sendEmailOtp({ email, name }) {
    return this.cognito.sendEmailOtp({ email, name });
  }

  async verifyEmailOtp(code) {
    const verifiedVisitor = await this.cognito.verifyEmailOtp(code);
    this.visitor = verifiedVisitor;
    this._notify();
    return this.visitor;
  }

  async startOAuthLogin({ provider = '' } = {}) {
    return this.cognito.startOAuthLogin({ provider });
  }

  async completeOAuthCallbackIfPresent() {
    const oauthVisitor = await this.cognito.handleOAuthCallbackIfPresent();
    if (oauthVisitor) {
      this.visitor = oauthVisitor;
      this._notify();
    }
    return oauthVisitor;
  }

  continueAsGuest() {
    this.visitor = {
      name: 'Guest',
      email: '',
      phone: '',
      mode: 'guest',
      verified: false,
      signedInAt: Date.now(),
    };
    this._notify();
    return this.visitor;
  }

  async signOut() {
    await this.cognito.signOut();
    this.visitor = null;
    this._notify();
  }
}
