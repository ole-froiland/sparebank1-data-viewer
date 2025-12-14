const { getValidAccessToken, forceRefreshAccessToken } = require("./_token");

const BASE_URL = "https://api.sparebank1.no/personal/banking/transactions";
const DEFAULT_TIMEOUT_MS = 10_000;

async function httpGet({ path, query, accept, expectBinary }) {
  const url = buildUrl(path, query);
  return withAuthRetry(async (token) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: accept,
        },
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        const err = new Error("Unauthorized");
        err.statusCode = res.status;
        err.unauthorized = true;
        throw err;
      }

      if (!res.ok) {
        const body = await safeJson(res);
        const message =
          body?.message ||
          body?.error_description ||
          body?.error ||
          res.statusText ||
          "Ukjent feil";
        const err = new Error(message);
        err.statusCode = res.status;
        err.body = body;
        throw err;
      }

      if (expectBinary) {
        const buffer = await res.arrayBuffer();
        return Buffer.from(buffer);
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function withAuthRetry(fn) {
  const primary = await getValidAccessToken();
  try {
    return await fn(primary);
  } catch (err) {
    if (err?.unauthorized) {
      const refreshed = await forceRefreshAccessToken();
      return fn(refreshed);
    }
    throw err;
  }
}

function buildUrl(path, query = {}) {
  const url = new URL(path, BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_e) {
    return null;
  }
}

module.exports = {
  httpGet,
};
