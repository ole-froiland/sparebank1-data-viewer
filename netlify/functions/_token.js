// Token helper for SpareBank 1 OAuth refresh flow.
// Caches access_token in memory across warm Netlify function invocations.

const OAUTH_TOKEN_URL = "https://api.sparebank1.no/oauth/token";
const EXPIRY_SKEW_MS = 30_000; // refresh a bit before expiry

const tokenState = {
  accessToken: null,
  refreshToken: process.env.REFRESH_TOKEN,
  expiresAt: 0,
};

function ensureEnv() {
  const missing = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"].filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === ""
  );
  if (missing.length) {
    const error = new Error(`Mangler env vars: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}

function hasValidAccessToken() {
  return (
    tokenState.accessToken &&
    tokenState.expiresAt &&
    Date.now() < tokenState.expiresAt - EXPIRY_SKEW_MS
  );
}

function setTokenState({ accessToken, expiresIn, refreshToken }) {
  tokenState.accessToken = accessToken;
  const lifetimeMs = Number.isFinite(expiresIn) ? expiresIn * 1000 : 3600 * 1000;
  tokenState.expiresAt = Date.now() + lifetimeMs;

  if (refreshToken) {
    tokenState.refreshToken = refreshToken;
    console.warn(
      "SpareBank 1 ga nytt refresh_token; oppdater REFRESH_TOKEN i env for å beholde det over deploy (token logges ikke)."
    );
  }
}

async function refreshAccessToken(reason = "refresh") {
  ensureEnv();
  const refreshToken = tokenState.refreshToken || process.env.REFRESH_TOKEN;
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = await safeJson(response);

  if (!response.ok) {
    const msg = payload?.error_description || payload?.error || response.statusText;
    const error = new Error(`Kunne ikke hente access_token (${reason}): ${msg || "ukjent feil"}`);
    error.statusCode = response.status;
    throw error;
  }

  if (!payload?.access_token) {
    const error = new Error("Svar mangler access_token");
    error.statusCode = 500;
    throw error;
  }

  setTokenState({
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
    refreshToken: payload.refresh_token,
  });

  return tokenState.accessToken;
}

async function getValidAccessToken() {
  if (hasValidAccessToken()) {
    return tokenState.accessToken;
  }
  return refreshAccessToken("initial or expired");
}

async function forceRefreshAccessToken() {
  tokenState.accessToken = null;
  tokenState.expiresAt = 0;
  return refreshAccessToken("forced after 401");
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

module.exports = {
  getValidAccessToken,
  forceRefreshAccessToken,
};
