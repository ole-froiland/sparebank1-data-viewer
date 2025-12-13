import { fetchAccounts } from "./scripts/mockApi.js";

const accountsGrid = document.getElementById("accounts-grid");
const totalBalanceEl = document.getElementById("total-balance");
const accountCountEl = document.getElementById("account-count");
const apiStatusEl = document.getElementById("api-status");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-button");

refreshButton.addEventListener("click", loadDashboard);
window.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
  setApiStatus("loading", "Henter mock-data …");
  toggleRefreshButton(true);

  try {
    const accounts = await fetchAccounts();
    renderAccounts(accounts);
    updateSummary(accounts);
    setApiStatus("ok", "Koble til ekte SpareBank 1 API når klar");
    setLastUpdated();
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
      <p class="account-meta">Kontonr: ${account.accountNumber}</p>
      <p class="account-balance">${formatCurrency(account.balance, account.currency)}</p>
      <p class="account-meta">Disponibelt: ${formatCurrency(account.available, account.currency)}</p>
    `;

    accountsGrid.appendChild(card);
  });
}

function updateSummary(accounts) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  totalBalanceEl.textContent = formatCurrency(total);
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

function formatCurrency(amount, currency = "NOK") {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Når du kobler til ekte API: bytt ut fetchAccounts med et kall som bruker fetch()
// og autentiseringstoken. Appen vil ellers fungere likt.
