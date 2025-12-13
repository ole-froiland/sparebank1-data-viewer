// Simulated SpareBank 1 API layer so du kan teste uten autentisering.
// Bytt ut fetchAccounts() med ekte HTTP-kall når du har tokens klart.

const mockAccounts = [
  {
    id: "1",
    name: "Brukskonto",
    accountNumber: "1201.23.45678",
    type: "Lønnskonto",
    balance: 24500.5,
    available: 23850.25,
    currency: "NOK",
  },
  {
    id: "2",
    name: "Sparekonto",
    accountNumber: "1201.98.76543",
    type: "Høyrentekonto",
    balance: 152300.75,
    available: 152300.75,
    currency: "NOK",
  },
  {
    id: "3",
    name: "Felleskonto",
    accountNumber: "1201.45.61234",
    type: "Felles",
    balance: 8200.0,
    available: 8000.0,
    currency: "NOK",
  },
  {
    id: "4",
    name: "Kortbruk",
    accountNumber: "1201.77.88888",
    type: "Debetkort",
    balance: -1250.4,
    available: -1250.4,
    currency: "NOK",
  },
];

export async function fetchAccounts() {
  // Litt forsinkelse gjør at UI-et ser mer "live" ut.
  await wait(380);

  // Klone data så UI-et ikke muterer originalen.
  const data = mockAccounts.map((account) => ({
    ...account,
    // Legg på et lite avvik for å illustrere at data endres mellom kall.
    balance: withTinyDrift(account.balance),
    available: withTinyDrift(account.available),
  }));

  return data;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTinyDrift(value) {
  const drift = (Math.random() - 0.5) * 100; // ±50 kroner
  return Math.round((value + drift) * 100) / 100;
}
