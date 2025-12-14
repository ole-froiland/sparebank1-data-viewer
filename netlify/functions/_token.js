// Token helper for SpareBank 1 OAuth refresh flow.
// Caches access_token across warm invocations and persists rotated refresh_tokens via Netlify Blobs.

const { getStore } = require("@netlify/blobs");

const OAUTH_TOKEN_URL = "https://api.sparebank1.no/oauth/token";
const EXPIRY_SKEW_MS = 30_000; // refresh slightly before expiry
const BLOB_STORE = getStore({ name: "sb1-oauth" });
const BLOB_KEY = "tokens.json";

const memoryState = {
  initialized: false,
  accessToken: null,
  expiresAt: 0,
  refreshToken: null,
  refreshSource: null, // "blob" | "env" | "rotated"
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

  envConfig = { clientId, clientSecret, refreshToken };

  console.info("[sb1-token] Env vars", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    refreshTokenLength: refreshToken ? refreshToken.length : 0,
  });

  if (!clientId || !clientSecret) {
    const error = new Error("Mangler SB1_CLIENT_ID eller SB1_CLIENT_SECRET i env");
    error.statusCode = 500;
    throw error;
  }

  if (!refreshToken) {
    console.warn("[sb1-token] Ingen refresh_token i env; forventer å finne en i blob store");
  }

  return envConfig;
}

async function ensureInitialized() {
  if (memoryState.initialized) return;

  const { refreshToken: envRefresh } = loadEnv();
  const stored = await readStoredTokens();

  if (stored?.refresh_token) {
    memoryState.refreshToken = cleanEnv(stored.refresh_token);
    memoryState.refreshSource = "blob";
  }

  const storedAccessStillValid =
    stored?.access_token &&
    stored?.expires_at &&
    Date.now() < Number(stored.expires_at) - EXPIRY_SKEW_MS;

  if (storedAccessStillValid) {
    memoryState.accessToken = stored.access_token;
    memoryState.expiresAt = Number(stored.expires_at);
    console.info("[sb1-token] Bruker access_token fra blob cache", {
      expiresAt: memoryState.expiresAt,
    });
  }

  if (!memoryState.refreshToken && envRefresh) {
    memoryState.refreshToken = envRefresh;
    memoryState.refreshSource = "env";
  }

  console.info("[sb1-token] Refresh token valgt", {
    source: memoryState.refreshSource || "unknown",
    hasRefreshToken: !!memoryState.refreshToken,
    refreshTokenLength: memoryState.refreshToken ? memoryState.refreshToken.length : 0,
  });

  memoryState.initialized = true;
}

function hasValidAccessToken() {
  return (
    memoryState.accessToken &&
    memoryState.expiresAt &&
    Date.now() < memoryState.expiresAt - EXPIRY_SKEW_MS
  );
}

async function getValidAccessToken() {
  await ensureInitialized();
  if (hasValidAccessToken()) {
    return memoryState.accessToken;
  }
  return refreshAccessToken("initial or expired");
}

async function forceRefreshAccessToken() {
  await ensureInitialized();
  memoryState.accessToken = null;
  memoryState.expiresAt = 0;
  return refreshAccessToken("forced after 401");
}

async function refreshAccessToken(reason = "refresh") {
  const { refreshToken: envRefresh } = loadEnv();
  await ensureInitialized();

  const primaryRefreshToken = memoryState.refreshToken || envRefresh;
  if (!primaryRefreshToken) {
    const error = new Error("Ingen refresh_token konfigurert i env eller blob");
    error.statusCode = 500;
    throw error;
  }

  try {
    return await requestNewToken({
      refreshToken: primaryRefreshToken,
      reason,
      source: memoryState.refreshSource || "env",
    });
  } catch (error) {
    const shouldRetryWithEnv =
      (error.statusCode === 400 || error.statusCode === 401) &&
      envRefresh &&
      envRefresh !== primaryRefreshToken;

    if (shouldRetryWithEnv) {
      console.warn("[sb1-token] Primær refresh_token feilet, prøver env-verdien som fallback");
      memoryState.refreshToken = envRefresh;
      memoryState.refreshSource = "env";
      return requestNewToken({
        refreshToken: envRefresh,
        reason: `${reason}-env-fallback`,
        source: "env",
      });
    }

    throw error;
  }
}

async function requestNewToken({ refreshToken, reason, source }) {
  const { clientId, clientSecret } = loadEnv();
  const cleanedRefreshToken = cleanEnv(refreshToken);

  console.info("[sb1-token] Henter nytt access_token", {
    reason,
    refreshSource: source,
    refreshTokenLength: cleanedRefreshToken ? cleanedRefreshToken.length : 0,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: cleanedRefreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const { payload, rawBody } = await parseBody(response);
  const sanitizedBody = payload ? sanitizePayload(payload) : scrubString(rawBody);

  const rotated =
    payload?.refresh_token && cleanEnv(payload.refresh_token) !== cleanedRefreshToken;

  console.info("[sb1-token] Token-endepunkt svart", {
    reason,
    status: response.status,
    ok: response.ok,
    rotated,
    body: sanitizedBody,
  });

  if (!response.ok) {
    const msg =
      payload?.error_description || payload?.error || (typeof rawBody === "string" ? rawBody : "");
    const error = new Error(
      `Kunne ikke hente access_token (${reason}): ${msg || response.statusText || "ukjent feil"}`
    );
    error.statusCode = response.status || 500;
    error.body = sanitizedBody;
    throw error;
  }

  if (!payload?.access_token) {
    const error = new Error("Svar mangler access_token");
    error.statusCode = 500;
    throw error;
  }

  const expiresInSeconds = Number.isFinite(Number(payload.expires_in))
    ? Number(payload.expires_in)
    : 3600;
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  const nextRefreshToken = cleanEnv(payload.refresh_token) || cleanedRefreshToken;

  memoryState.accessToken = payload.access_token;
  memoryState.expiresAt = expiresAt;
  memoryState.refreshToken = nextRefreshToken;
  memoryState.refreshSource = rotated ? "rotated" : source || "env";

  if (rotated) {
    console.warn("[sb1-token] Refresh_token roterte; lagrer oppdatert verdi i blob store");
  }

  await persistTokens({
    accessToken: memoryState.accessToken,
    refreshToken: nextRefreshToken,
    expiresAt,
  });

  return memoryState.accessToken;
}

async function readStoredTokens() {
  try {
    const stored = await BLOB_STORE.get(BLOB_KEY, { type: "json" });
    if (!stored) {
      console.info("[sb1-token] Ingen token-blob funnet, bruker env");
      return null;
    }
    console.info("[sb1-token] Lastet token data fra blob", {
      hasAccessToken: !!stored.access_token,
      hasRefreshToken: !!stored.refresh_token,
      refreshTokenLength: stored.refresh_token ? String(stored.refresh_token).length : 0,
      expiresAt: stored.expires_at || null,
    });
    return stored;
  } catch (error) {
    console.error("[sb1-token] Klarte ikke lese blob store", error);
    return null;
  }
}

async function persistTokens({ accessToken, refreshToken, expiresAt }) {
  try {
    await BLOB_STORE.set(
      BLOB_KEY,
      JSON.stringify(
        {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          saved_at: Date.now(),
        },
        null,
        2
      ),
      { contentType: "application/json" }
    );
  } catch (error) {
    console.error("[sb1-token] Klarte ikke lagre tokens til blob store", error);
  }
}

async function parseBody(response) {
  const rawBody = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (_err) {
    payload = null;
  }
  return { payload, rawBody };
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const safe = { ...payload };
  if ("access_token" in safe) safe.access_token = "[redacted]";
  if ("refresh_token" in safe) safe.refresh_token = "[redacted]";
  if ("id_token" in safe) safe.id_token = "[redacted]";
  return safe;
}

function scrubString(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]");
}

module.exports = {
  getValidAccessToken,
  forceRefreshAccessToken,
};
