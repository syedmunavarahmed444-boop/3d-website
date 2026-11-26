const env = import.meta.env || {};

export const COGNITO_CONFIG = {
  region: env.VITE_COGNITO_REGION || 'ap-southeast-2',
  userPoolId: env.VITE_COGNITO_USER_POOL_ID || 'ap-southeast-2_eAwdsaCYa',
  clientId: env.VITE_COGNITO_CLIENT_ID || '5gbndef1junsp1gqke1e5dcftp',
  domain: (
    env.VITE_COGNITO_DOMAIN || 'https://sultan-sports-kadapa-auth.auth.ap-southeast-2.amazoncognito.com'
  ).replace(/\/$/, ''),
  googleEnabled: String(env.VITE_COGNITO_GOOGLE_ENABLED || 'false').toLowerCase() === 'true',
};

const PKCE_STORAGE_KEY = 'sultan_cognito_pkce_v1';
const TOKENS_STORAGE_KEY = 'sultan_cognito_tokens_v1';

function base64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLen = 32) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function generateStrongOneTimePassword() {
  // Meets Cognito 12+ char uppercase/lowercase/number/symbol policy; never shown or reused
  return `Ss!${randomBase64Url(12)}9aZ#`;
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function currentRedirectUri() {
  return `${window.location.origin}/`;
}

async function cognitoRpc(action, payload) {
  const endpoint = `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawType = (data.__type || '').split('#').pop() || 'CognitoError';
    const err = new Error(data.message || data.Message || rawType);
    err.code = rawType;
    throw err;
  }
  return data;
}

/**
 * Lightweight zero-dependency Amazon Cognito client:
 * - Real Passwordless Email 6-Digit OTP (USER_AUTH + EMAIL_OTP + auto SignUp/ConfirmSignUp)
 * - Real OAuth 2.0 Authorization Code Grant with PKCE + CSRF state + OIDC nonce (Google / Managed Login v2)
 */
export class CognitoAuthClient {
  constructor() {
    this.pendingOtp = null;
  }

  isGoogleEnabled() {
    return COGNITO_CONFIG.googleEnabled;
  }

  /**
   * Sends a real 6-digit verification/sign-in OTP to the customer's email via Amazon Cognito.
   */
  async sendEmailOtp({ email, name }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address (e.g. name@gmail.com).');
    }

    try {
      // Returning user -> direct passwordless EMAIL_OTP challenge!
      const init = await cognitoRpc('InitiateAuth', {
        AuthFlow: 'USER_AUTH',
        ClientId: COGNITO_CONFIG.clientId,
        AuthParameters: {
          USERNAME: cleanEmail,
          PREFERRED_CHALLENGE: 'EMAIL_OTP',
        },
      });

      if (init.ChallengeName === 'EMAIL_OTP' && init.Session) {
        this.pendingOtp = {
          mode: 'signin_otp',
          email: cleanEmail,
          name: cleanName,
          session: init.Session,
        };
        return {
          mode: 'signin_otp',
          destination: init.ChallengeParameters?.CODE_DELIVERY_DESTINATION || cleanEmail,
        };
      }

      throw new Error('Cognito did not return an Email OTP challenge. Please try OAuth Sign-In.');
    } catch (err) {
      if (err.code === 'UserNotFoundException') {
        // Brand-new shopper -> seamless passwordless SignUp so Cognito emails a 6-digit code!
        const displayName = cleanName || cleanEmail.split('@')[0];
        const signUpRes = await cognitoRpc('SignUp', {
          ClientId: COGNITO_CONFIG.clientId,
          Username: cleanEmail,
          Password: generateStrongOneTimePassword(),
          UserAttributes: [
            { Name: 'email', Value: cleanEmail },
            { Name: 'name', Value: displayName },
          ],
        });
        this.pendingOtp = {
          mode: 'signup_confirm',
          email: cleanEmail,
          name: displayName,
        };
        return {
          mode: 'signup_confirm',
          destination: signUpRes.CodeDeliveryDetails?.Destination || cleanEmail,
        };
      }

      if (err.code === 'UserNotConfirmedException') {
        const resendRes = await cognitoRpc('ResendConfirmationCode', {
          ClientId: COGNITO_CONFIG.clientId,
          Username: cleanEmail,
        });
        this.pendingOtp = {
          mode: 'signup_confirm',
          email: cleanEmail,
          name: cleanName || cleanEmail.split('@')[0],
        };
        return {
          mode: 'signup_confirm',
          destination: resendRes.CodeDeliveryDetails?.Destination || cleanEmail,
        };
      }

      throw err;
    }
  }

  /**
   * Verifies the 6-digit email OTP code with Amazon Cognito.
   */
  async verifyEmailOtp(code) {
    const cleanCode = String(code || '').replace(/\D/g, '').trim();
    if (cleanCode.length < 6) {
      throw new Error('Please enter the 6-digit code from your email.');
    }
    if (!this.pendingOtp) {
      throw new Error('No pending OTP session. Please request a fresh code.');
    }

    const pending = this.pendingOtp;

    if (pending.mode === 'signin_otp') {
      const res = await cognitoRpc('RespondToAuthChallenge', {
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeName: 'EMAIL_OTP',
        Session: pending.session,
        ChallengeResponses: {
          USERNAME: pending.email,
          EMAIL_OTP_CODE: cleanCode,
        },
      });

      const tokens = res.AuthenticationResult;
      if (!tokens?.IdToken) {
        throw new Error('Verification did not complete. Please request a new code.');
      }
      this._storeTokens(tokens);
      const claims = decodeJwtPayload(tokens.IdToken) || {};
      this.pendingOtp = null;
      return {
        name: pending.name || claims.name || pending.email.split('@')[0],
        email: claims.email || pending.email,
        phone: claims.phone_number || '',
        sub: claims.sub || '',
        mode: 'cognito-email-otp',
        verified: true,
        signedInAt: Date.now(),
      };
    }

    // New user confirmation via Cognito's real emailed 6-digit code
    await cognitoRpc('ConfirmSignUp', {
      ClientId: COGNITO_CONFIG.clientId,
      Username: pending.email,
      ConfirmationCode: cleanCode,
    });
    this.pendingOtp = null;
    return {
      name: pending.name || pending.email.split('@')[0],
      email: pending.email,
      phone: '',
      mode: 'cognito-email-verified',
      verified: true,
      signedInAt: Date.now(),
    };
  }

  /**
   * Starts OAuth 2.0 Authorization Code Grant + PKCE + state + nonce against Cognito Managed Login v2
   * (or directly to Google when Google IdP is attached).
   */
  async startOAuthLogin({ provider = '' } = {}) {
    const verifier = randomBase64Url(32);
    const challenge = await sha256Base64Url(verifier);
    const state = randomBase64Url(24);
    const nonce = randomBase64Url(24);
    const redirectUri = currentRedirectUri();

    sessionStorage.setItem(
      PKCE_STORAGE_KEY,
      JSON.stringify({ verifier, state, nonce, redirectUri, createdAt: Date.now() })
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: COGNITO_CONFIG.clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    if (provider) {
      params.set('identity_provider', provider);
    }

    window.location.assign(`${COGNITO_CONFIG.domain}/oauth2/authorize?${params.toString()}`);
  }

  /**
   * Detects `?code=...&state=...` after returning from Google / Cognito OAuth, validates CSRF state
   * and OIDC nonce, exchanges the code with PKCE verifier, and returns the verified visitor profile.
   */
  async handleOAuthCallbackIfPresent() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const oauthErr = url.searchParams.get('error');

    if (oauthErr) {
      const desc = url.searchParams.get('error_description') || oauthErr;
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, url.pathname + url.search);
      throw new Error(`OAuth sign-in canceled: ${desc}`);
    }

    if (!code) return null;

    // Immediately clean single-use code & state from the address bar
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.pathname + url.search);

    const savedRaw = sessionStorage.getItem(PKCE_STORAGE_KEY);
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
    if (!savedRaw) {
      throw new Error('OAuth session expired. Please try signing in again.');
    }

    const saved = JSON.parse(savedRaw);
    if (!returnedState || returnedState !== saved.state) {
      throw new Error('OAuth state check failed (possible CSRF). Please try again.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: COGNITO_CONFIG.clientId,
      code,
      redirect_uri: saved.redirectUri,
      code_verifier: saved.verifier,
    });

    const tokenRes = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokens.id_token) {
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed.');
    }

    const claims = decodeJwtPayload(tokens.id_token) || {};
    if (saved.nonce && claims.nonce && claims.nonce !== saved.nonce) {
      throw new Error('OAuth nonce verification failed. Please sign in again.');
    }

    this._storeTokens({
      IdToken: tokens.id_token,
      AccessToken: tokens.access_token,
      RefreshToken: tokens.refresh_token,
    });

    const email = claims.email || '';
    return {
      name: claims.name || claims.given_name || (email ? email.split('@')[0] : 'Shopper'),
      email,
      phone: claims.phone_number || '',
      sub: claims.sub || '',
      mode: 'cognito-oauth',
      verified: true,
      signedInAt: Date.now(),
    };
  }

  _storeTokens(tokens) {
    try {
      sessionStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      // Ignore storage errors in private mode
    }
  }

  async signOut() {
    this.pendingOtp = null;
    try {
      const raw = sessionStorage.getItem(TOKENS_STORAGE_KEY);
      sessionStorage.removeItem(TOKENS_STORAGE_KEY);
      if (raw) {
        const tokens = JSON.parse(raw);
        if (tokens?.RefreshToken) {
          await fetch(`${COGNITO_CONFIG.domain}/oauth2/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              token: tokens.RefreshToken,
              client_id: COGNITO_CONFIG.clientId,
            }).toString(),
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore revocation errors during sign-out
    }
  }
}
