import { getAccessToken, forceRefreshAccessToken } from "./_token.js";

const API_BASE = "https://api.sparebank1.no/personal/banking/accounts";
const ACCEPT_HEADER = "application/vnd.sparebank1.v1+json; charset=utf-8";

export default async (_req, _context) => {
  if (_req.method !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  try {
    const accounts = await fetchAccountsWithRetry();
    return jsonResponse(200, { accounts });
  } catch (error) {
    console.error("accounts handler error", {
      message: error.message,
      statusCode: error.statusCode || error.status,
    });
    const status = error.statusCode || 500;
    return jsonResponse(status, {
      error: true,
      message: error.message || "Ukjent feil",
      code: error.code,
    });
  }
};

async function fetchAccountsWithRetry() {
  // First attempt with cached/valid token.
  const primaryToken = await getAccessToken();
  const primaryResult = await fetchAccounts(primaryToken);

  if (!primaryResult.unauthorized) {
    return normalizeAccounts(primaryResult.data);
  }

  // If unauthorized, force refresh and try once more.
  const refreshedToken = await forceRefreshAccessToken();
  const retryResult = await fetchAccounts(refreshedToken);

  if (retryResult.unauthorized) {
    const error = new Error("Ingen tilgang (401/403) fra SpareBank 1 API");
    error.statusCode = retryResult.status || 401;
    throw error;
  }

  return normalizeAccounts(retryResult.data);
}

async function fetchAccounts(accessToken) {
  const response = await fetch(API_BASE, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: ACCEPT_HEADER,
    },
  });

  if (response.status === 401 || response.status === 403) {
    return { unauthorized: true, status: response.status };
  }

  const payload = await safeJson(response);

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
        payload?.error_description ||
        payload?.error ||
        `Feil fra SpareBank 1: ${response.statusText}`
    );
    error.statusCode = response.status;
    throw error;
  }

  return { data: payload };
}

function normalizeAccounts(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.accounts)
    ? payload.accounts
    : [];

  return list.map(normalizeAccount);
}

function normalizeAccount(account) {
  const accountNumberRaw =
    account?.accountNumber?.value ||
    account?.accountNumber?.formatted ||
    account?.accountNumber ||
    account?.number ||
    "";

  const currency =
    pickValue(account, ["balance.currency", "availableBalance.currency", "currency"]) || "NOK";

  const balance = toNumber(
    pickValue(account, [
      "balance.amount",
      "balance.value",
      "balances.balance.amount",
      "balances.book.amount",
      "currentBalance",
      "balance",
    ])
  );

  const availableBalance = toNumber(
    pickValue(account, [
      "availableBalance.amount",
      "availableBalance.value",
      "balances.available.amount",
      "balances.available",
      "available",
      "availableAmount",
    ])
  );

  return {
    id: account?.id || account?.accountId || accountNumberRaw || String(Math.random()),
    name: account?.name || account?.accountName || account?.nickname || "Konto",
    type: account?.type || account?.accountType || account?.productType || "Konto",
    accountNumberMasked: maskAccountNumber(accountNumberRaw),
    balance,
    availableBalance,
    currency,
  };
}

function maskAccountNumber(number) {
  if (!number) return "****";
  const digits = String(number).replace(/\s+/g, "");
  const last4 = digits.slice(-4) || "****";
  return `**** **** ${last4}`;
}

function pickValue(obj, paths) {
  for (const path of paths) {
    const value = get(obj, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function toNumber(value) {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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
    headers: { "Content-Type": "application/json" },
  });
}
