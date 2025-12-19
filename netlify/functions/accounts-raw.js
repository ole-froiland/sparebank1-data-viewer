import { getAccessToken, forceRefreshAccessToken } from "./_token.js";

const API_URL = "https://api.sparebank1.no/personal/banking/accounts";
const ACCEPT_HEADER = "application/vnd.sparebank1.v1+json; charset=utf-8";
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  try {
    const payload = await fetchAccountsWithRetry();
    return jsonResponse(200, payload);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return jsonResponse(status, {
      error: true,
      message: error.message || "Ukjent feil",
      code: error.code || "ACCOUNT_FETCH_FAILED",
    });
  }
};

async function fetchAccountsWithRetry() {
  const primaryToken = await getAccessToken();
  const primaryResult = await fetchAccounts(primaryToken);

  if (!primaryResult.unauthorized) {
    return primaryResult.data;
  }

  const refreshedToken = await forceRefreshAccessToken();
  const retryResult = await fetchAccounts(refreshedToken);

  if (retryResult.unauthorized) {
    const error = new Error("Ingen tilgang (401/403) fra SpareBank 1 API");
    error.statusCode = retryResult.status || 401;
    throw error;
  }

  return retryResult.data;
}

async function fetchAccounts(accessToken) {
  const response = await fetch(API_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: ACCEPT_HEADER,
    },
  });

  const payload = await safeJson(response);

  if (response.status === 401 || response.status === 403) {
    return { unauthorized: true, status: response.status };
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error_description ||
        payload?.error ||
        payload?.message ||
        response.statusText ||
        "Feil fra SpareBank 1 API"
    );
    error.statusCode = response.status;
    error.code = payload?.error;
    throw error;
  }

  return { data: payload };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: CORS_HEADERS,
  });
}
