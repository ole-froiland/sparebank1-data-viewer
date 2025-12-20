// Token helper for SpareBank 1 OAuth refresh flow using env-only configuration.
// Caches access_token in memory per runtime instance; does not persist refresh_token changes.

const OAUTH_TOKEN_URL = "https://api.sparebank1.no/oauth/token";
const EXPIRY_SKEW_MS = 30_000; // refresh slightly before expiry

const state = {
  accessToken: null,
  expiresAt: 0,
  refreshToken: null,
};

let envConfig = null;

function cleanEnv(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/^['"]+|['"]+$/g, "");
}

function loadEnv() {
  if (envConfig) return envConfig;

  const clientId = cleanEnv(process.env.SB1_CLIENT_ID || process.env.CLIENT_ID);
  const clientSecret = cleanEnv(process.env.SB1_CLIENT_SECRET || process.env.CLIENT_SECRET);
  const refreshToken = cleanEnv(process.env.SB1_REFRESH_TOKEN || process.env.REFRESH_TOKEN);

  console.info("[sb1-token] Env vars", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    refreshTokenLength: refreshToken ? refreshToken.length : 0,
  });

  if (!clientId || !clientSecret) {
    const err = new Error("Mangler SB1_CLIENT_ID eller SB1_CLIENT_SECRET i env");
    err.statusCode = 500;
    throw err;
  }

  if (!refreshToken) {
    const err = new Error("Mangler SB1_REFRESH_TOKEN i env");
    err.statusCode = 500;
    throw err;
  }

  envConfig = { clientId, clientSecret, refreshToken };
  return envConfig;
}

function hasValidAccessToken() {
  return (
    state.accessToken &&
    state.expiresAt &&
    Date.now() < Number(state.expiresAt) - EXPIRY_SKEW_MS
  );
}

async function getAccessToken(forceRefresh = false) {
  const { clientId, clientSecret, refreshToken } = loadEnv();
  state.refreshToken = state.refreshToken || refreshToken;

  if (!forceRefresh && hasValidAccessToken()) {
    return state.accessToken;
  }

  return refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken: state.refreshToken || refreshToken,
    force: forceRefresh,
  });
}

async function forceRefreshAccessToken() {
  return getAccessToken(true);
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken, force }) {
  const cleanedRefreshToken = cleanEnv(refreshToken);
  if (!cleanedRefreshToken) {
    const err = new Error("Mangler refresh_token i env (SB1_REFRESH_TOKEN)");
    err.statusCode = 500;
    throw err;
  }

  console.info("[sb1-token] Henter access_token", {
    forceRefresh: !!force,
    hasCachedToken: !!state.accessToken,
    refreshTokenLength: cleanedRefreshToken.length,
    cachedExpiresAt: state.expiresAt || null,
  });

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cleanedRefreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: "https://localhost",
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (_err) {
    payload = null;
  }

  const rotated =
    payload?.refresh_token && cleanEnv(payload.refresh_token) !== cleanedRefreshToken;

  console.info("[sb1-token] Token-endepunkt", {
    status: response.status,
    ok: response.ok,
    hasAccessToken: !!payload?.access_token,
    expiresIn: payload?.expires_in || null,
    refreshTokenRotated: !!rotated,
  });

  if (!response.ok) {
    const msg =
      payload?.error_description ||
      payload?.error ||
      (typeof text === "string" ? text : "") ||
      response.statusText ||
      "ukjent feil";
    const err = new Error(`Kunne ikke hente access_token: ${msg}`);
    err.statusCode = response.status || 500;
    err.code = payload?.error || "TOKEN_REQUEST_FAILED";
    throw err;
  }

  if (!payload?.access_token) {
    const err = new Error("Svar mangler access_token");
    err.statusCode = 500;
    throw err;
  }

  if (rotated) {
    console.warn("[sb1-token] refresh token rotated; oppdater SB1_REFRESH_TOKEN manuelt", {
      incomingRefreshTokenLength: payload.refresh_token ? String(payload.refresh_token).length : 0,
    });
    const err = new Error("Refresh token rotated; oppdater SB1_REFRESH_TOKEN");
    err.code = "REFRESH_TOKEN_ROTATED";
    err.statusCode = 500;
    throw err;
  }

  const expiresInSeconds = Number.isFinite(Number(payload.expires_in))
    ? Number(payload.expires_in)
    : 3600;

  state.accessToken = payload.access_token;
  state.expiresAt = Date.now() + expiresInSeconds * 1000;
  state.refreshToken = cleanedRefreshToken;

  return state.accessToken;
}

module.exports = {
  getAccessToken,
  forceRefreshAccessToken,
  cleanEnv,
};
