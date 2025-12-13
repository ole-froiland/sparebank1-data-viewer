# sparebank1-data-viewer

Statisk frontend som viser kontoer og saldo fra SpareBank 1 via mock-data (ingen backend kreves i første versjon).

## Filstruktur
- `index.html` – enkel dashboard-side.
- `styles.css` – layout/tema for dashboardet.
- `app.js` – UI-logikk som henter data og oppdaterer DOM.
- `scripts/mockApi.js` – mock-spørring som simulerer SpareBank 1 API.

## Kjør lokalt
1. Åpne en terminal i prosjektmappen.
2. Start en liten webserver (trengs fordi JavaScript-moduler ikke laster fra `file://`):
   ```bash
   python3 -m http.server 8000
   ```
3. Åpne [http://localhost:8000](http://localhost:8000) i nettleseren.
4. Klikk «Oppdater data» for å hente mock-data. Bytt ut `fetchAccounts()` i `app.js`/`scripts/mockApi.js` med ekte fetch-kall når autentisering er på plass.
