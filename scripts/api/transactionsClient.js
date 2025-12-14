const JSON_ACCEPT = "application/vnd.sparebank1.v1+json; charset=utf-8";
const CSV_ACCEPT = "application/csv;charset=UTF-8";

const endpoints = {
  list: "/.netlify/functions/transactions",
  classified: "/.netlify/functions/transactions-classified",
  details: "/.netlify/functions/transaction-details",
  detailsClassified: "/.netlify/functions/transaction-details-classified",
  exportCsv: "/.netlify/functions/transactions-export",
};

export async function listTransactions(params) {
  return getJson(endpoints.list, params);
}

export async function listClassifiedTransactions(params) {
  return getJson(endpoints.classified, params);
}

export async function getTransactionDetails(id) {
  return getJson(endpoints.details, { id });
}

export async function getTransactionDetailsClassified(id, params = {}) {
  return getJson(endpoints.detailsClassified, { id, ...params });
}

export async function exportTransactionsCsv(params) {
  const url = buildUrl(endpoints.exportCsv, params);
  const response = await fetch(url, {
    headers: { Accept: CSV_ACCEPT },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Kunne ikke eksportere CSV");
  }
  const blob = await response.blob();
  return blob;
}

async function getJson(endpoint, params) {
  const url = buildUrl(endpoint, params);
  const response = await fetch(url, {
    headers: { Accept: JSON_ACCEPT },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.message || "Kunne ikke hente data");
  }
  return payload;
}

function buildUrl(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}
