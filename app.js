import {
  listTransactions,
  listClassifiedTransactions,
  getTransactionDetails,
  getTransactionDetailsClassified,
  exportTransactionsCsv,
} from "./scripts/api/transactionsClient.js";

const accountsGrid = document.getElementById("accounts-grid");
const totalBalanceEl = document.getElementById("total-balance");
const accountCountEl = document.getElementById("account-count");
const apiStatusEl = document.getElementById("api-status");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-button");
const navButtons = document.querySelectorAll(".nav-link");
const views = document.querySelectorAll(".view");
const tabButtons = document.querySelectorAll(".pill-button");
const transactionsBody = document.getElementById("transactions-body");
const filtersForm = document.getElementById("transactions-filters");
const statusEl = document.getElementById("transactions-status");
const exportButton = document.getElementById("export-csv");
const modal = document.getElementById("transaction-modal");
const modalBody = document.getElementById("modal-body");
const closeModalBtn = document.getElementById("close-modal");
const filterAccountKey = document.getElementById("filter-accountKey");
const filterFromDate = document.getElementById("filter-fromDate");
const filterToDate = document.getElementById("filter-toDate");
const filterRowLimit = document.getElementById("filter-rowLimit");
const filterSource = document.getElementById("filter-source");

let transactionsState = {
  tab: "standard",
  loading: false,
  lastResult: null,
  debounceTimer: null,
};

refreshButton.addEventListener("click", loadDashboard);
window.addEventListener("DOMContentLoaded", loadDashboard);
navButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    setActiveView(view);
  })
);
tabButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    transactionsState.tab = btn.dataset.tab;
    loadTransactions();
  })
);
filtersForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  loadTransactions();
});

[filterAccountKey, filterFromDate, filterToDate, filterRowLimit, filterSource].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => {
    clearTimeout(transactionsState.debounceTimer);
    transactionsState.debounceTimer = setTimeout(() => loadTransactions(), 300);
  });
});

exportButton?.addEventListener("click", handleExport);
closeModalBtn?.addEventListener("click", () => {
  modal.classList.add("hidden");
});
modal?.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

async function loadDashboard() {
  setApiStatus("loading", "Henter data …");
  toggleRefreshButton(true);

  try {
    const accounts = await fetchAccountsFromApi();
    renderAccounts(accounts);
    updateSummary(accounts);
    setApiStatus("ok", "Data fra SpareBank 1 via proxy");
    setLastUpdated();
    await loadTransactions();
  } catch (error) {
    console.error(error);
    showError(error);
  } finally {
    toggleRefreshButton(false);
  }
}

function renderAccounts(accounts) {
  accountsGrid.innerHTML = "";

  if (!accounts.length) {
    const empty = document.createElement("p");
    empty.className = "meta-text";
    empty.textContent = "Ingen kontoer å vise.";
    accountsGrid.appendChild(empty);
    return;
  }

  accounts.forEach((account) => {
    const card = document.createElement("article");
    card.className = "account-card";

    card.innerHTML = `
      <div class="account-header">
        <p class="account-name">${account.name}</p>
        <span class="pill">${account.type}</span>
      </div>
      <p class="account-meta">Kontonr: ${account.accountNumberMasked}</p>
      <p class="account-balance">${formatCurrency(account.balance, account.currency)}</p>
      <p class="account-meta">Disponibelt: ${formatCurrency(
        account.availableBalance ?? account.available,
        account.currency
      )}</p>
    `;

    accountsGrid.appendChild(card);
  });
}

function updateSummary(accounts) {
  const total = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
  totalBalanceEl.textContent = formatCurrency(total || 0);
  accountCountEl.textContent = accounts.length;
}

function setApiStatus(state, text) {
  apiStatusEl.textContent = text;
  apiStatusEl.classList.remove("status-idle", "status-loading", "status-ok", "status-error");
  apiStatusEl.classList.add(`status-${state}`);
}

function setLastUpdated() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  lastUpdatedEl.textContent = `Sist oppdatert: ${formatter.format(now)}`;
}

function showError(error) {
  setApiStatus("error", "Klarte ikke hente data");
  accountsGrid.innerHTML = `
    <div class="account-card">
      <p class="account-name">Feil</p>
      <p class="account-meta">${error.message ?? "Ukjent feil"}</p>
      <p class="account-meta">Prøv igjen eller sjekk nettverket.</p>
    </div>
  `;
  totalBalanceEl.textContent = "–";
  accountCountEl.textContent = "–";
}

function toggleRefreshButton(disabled) {
  refreshButton.disabled = disabled;
  refreshButton.textContent = disabled ? "Henter ..." : "Oppdater data";
}

function setActiveView(viewName) {
  views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });

  navButtons.forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

async function fetchAccountsFromApi() {
  const response = await fetch("/.netlify/functions/accounts");
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.message || "Kunne ikke hente kontoer");
  }

  return payload.accounts || [];
}

function formatCurrency(amount, currency = "NOK") {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Frontend lager nå kall til Netlify Function som håndterer token og proxier til SpareBank 1.

async function loadTransactions() {
  if (transactionsState.loading) return;
  transactionsState.loading = true;
  setTransactionStatus("Laster transaksjoner …");

  try {
    const filters = readFilters();
    let data;
    if (transactionsState.tab === "classified") {
      data = await listClassifiedTransactions(filters);
    } else {
      data = await listTransactions(filters);
    }
    transactionsState.lastResult = data;
    renderTransactions(data, transactionsState.tab === "classified");
    setTransactionStatus(data.errors ? `Advarsel: ${data.errors}` : "Klar");
  } catch (error) {
    console.error(error);
    transactionsBody.innerHTML = `<tr><td colspan="8" class="meta-text">Feil: ${
      error.message || "Ukjent feil"
    }</td></tr>`;
    setTransactionStatus("Feil ved henting");
  } finally {
    transactionsState.loading = false;
  }
}

function readFilters() {
  const accountKey = filterAccountKey.value
    ? filterAccountKey.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  return {
    accountKey,
    fromDate: filterFromDate.value || undefined,
    toDate: filterToDate.value || undefined,
    rowLimit: filterRowLimit.value || undefined,
    source: filterSource.value || undefined,
  };
}

function renderTransactions(data, classifiedMode) {
  const list = Array.isArray(data?.transactions) ? data.transactions : [];
  if (!list.length) {
    transactionsBody.innerHTML = `<tr><td colspan="8" class="meta-text">Ingen transaksjoner</td></tr>`;
    return;
  }

  transactionsBody.innerHTML = "";
  list.forEach((item) => {
    const tx = classifiedMode ? item.transaction : item;
    if (!tx) return;
    const row = document.createElement("tr");
    const canDetails = tx.canShowDetails !== false;
    if (canDetails) {
      row.tabIndex = 0;
      row.className = "clickable-row";
      row.addEventListener("click", () => openDetails(tx.id, classifiedMode));
      row.addEventListener("keypress", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetails(tx.id, classifiedMode);
        }
      });
    }

    const merchantName = tx.merchant?.name || tx.description || tx.cleanedDescription || "–";
    const amountCls = tx.amount >= 0 ? "positive" : "negative";
    const categories = classifiedMode
      ? formatCategories(item.categories)
      : "";

    row.innerHTML = `
      <td>${formatDate(tx.date)}</td>
      <td>${tx.description || tx.cleanedDescription || "–"}</td>
      <td>${merchantName}</td>
      <td class="amount ${amountCls}">${formatCurrency(tx.amount, tx.currencyCode || tx.accountCurrency || "NOK")}</td>
      <td>${tx.currencyCode || tx.accountCurrency || "NOK"}</td>
      <td>${tx.bookingStatus || tx.source || "–"}</td>
      <td>${tx.accountName || tx.accountKey || "–"}</td>
      <td class="classified-col">${categories}</td>
    `;

    transactionsBody.appendChild(row);
  });
}

function formatCategories(categories) {
  if (!categories || !categories.length) return "";
  return categories
    .map((c) => `${c.main || ""}${c.sub ? " / " + c.sub : ""}${c.confidence ? ` (${c.confidence})` : ""}`)
    .join(", ");
}

function formatDate(value) {
  if (!value) return "–";
  // API viser epoch på listekallet
  if (typeof value === "number") {
    return new Date(value).toLocaleDateString("nb-NO");
  }
  // detaljkallet bruker yyyy-MM-dd
  if (typeof value === "string") {
    return new Date(value).toLocaleDateString("nb-NO");
  }
  return "–";
}

async function openDetails(id, classifiedMode) {
  if (!id) return;
  modal.classList.remove("hidden");
  modalBody.innerHTML = `<p class="meta-text">Laster detaljer …</p>`;
  try {
    const data = classifiedMode
      ? await getTransactionDetailsClassified(id, { enrichWithMerchantData: true })
      : await getTransactionDetails(id);
    renderDetails(data, classifiedMode);
  } catch (error) {
    modalBody.innerHTML = `<p class="meta-text">Feil: ${error.message || "Ukjent feil"}</p>`;
  }
}

function renderDetails(data, classifiedMode) {
  if (!data) {
    modalBody.innerHTML = `<p class="meta-text">Ingen detaljer</p>`;
    return;
  }
  const tx = classifiedMode ? data.transaction : data;
  const merchant = classifiedMode ? data.merchant || tx?.merchant : tx?.merchant;
  const categories = classifiedMode ? formatCategories(data.categories) : "";
  modalBody.innerHTML = `
    <h3>Detaljer</h3>
    <p><strong>Beløp:</strong> ${formatCurrency(tx.amount, tx.currencyCode || tx.accountCurrency || "NOK")}</p>
    <p><strong>Dato:</strong> ${formatDate(tx.date)}</p>
    <p><strong>Status:</strong> ${tx.bookingStatus || tx.type || tx.typeText || "–"}</p>
    <p><strong>Beskrivelse:</strong> ${tx.description || tx.cleanedDescription || tx.originalDescription || "–"}</p>
    <p><strong>Konto:</strong> ${tx.accountName || "–"} (${tx.accountNumber?.formatted || tx.accountNumber?.value || "–"})</p>
    <p><strong>Merchant:</strong> ${merchant?.name || "–"}</p>
    ${categories ? `<p><strong>Kategori:</strong> ${categories}</p>` : ""}
    ${classifiedMode && data.minna ? `<p><strong>Minna:</strong> ${JSON.stringify(data.minna)}</p>` : ""}
    ${renderPaymentDetails(tx.paymentDetails)}
  `;
}

function renderPaymentDetails(details) {
  if (!details) return "";
  const charges = Array.isArray(details.serviceCharges)
    ? details.serviceCharges
        .map(
          (c) =>
            `${c.chargedAmount || ""} ${c.chargedAmountCurrency || ""} ${c.paidBy ? `(${c.paidBy})` : ""}`
        )
        .join(", ")
    : "";
  return `
    <div class="detail-block">
      <h4>Betalingsdetaljer</h4>
      <p><strong>KID/Melding:</strong> ${details.paymentReference || details.message || "–"}</p>
      <p><strong>Beløp:</strong> ${details.amount || ""} ${details.amountCurrency || ""}</p>
      <p><strong>Mottaker:</strong> ${details.payeeEmailAddress || "–"}</p>
      <p><strong>Bank:</strong> ${details.payeeBankName || ""} ${details.payeeBicSwift || ""}</p>
      ${charges ? `<p><strong>Service charges:</strong> ${charges}</p>` : ""}
    </div>
  `;
}

async function handleExport() {
  try {
    const filters = readFilters();
    if (!filters.accountKey.length || !filters.fromDate || !filters.toDate) {
      alert("accountKey, fromDate og toDate er påkrevd for eksport");
      return;
    }
    setTransactionStatus("Eksporterer …");
    const blob = await exportTransactionsCsv({
      accountKey: filters.accountKey[0],
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${filters.accountKey[0]}_${filters.fromDate}_${filters.toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setTransactionStatus("Eksport fullført");
  } catch (error) {
    console.error(error);
    setTransactionStatus(`Feil ved eksport: ${error.message || "Ukjent feil"}`);
  }
}

function setTransactionStatus(text) {
  if (statusEl) statusEl.textContent = text || "";
}
