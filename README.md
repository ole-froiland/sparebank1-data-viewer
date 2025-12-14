# sparebank1-data-viewer

Statisk frontend som viser kontoer og saldo fra SpareBank 1 via Netlify Function-proxy (ingen secrets i frontend).

## Filstruktur
- `index.html` – dashboard-side.
- `styles.css` – layout/tema for dashboardet.
- `app.js` – UI-logikk som henter data via Netlify Function.
- `netlify/functions/accounts.js` – proxy mot SpareBank 1 konto-API.
- `netlify/functions/_token.js` – tokenhåndtering (cache + refresh).
- `.env.example` – env-variabler som må settes lokalt/Netlify.

## Miljøvariabler
Legg inn disse (lokalt i `.env`, i Netlify UI under Site settings → Environment):
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

## Kjør lokalt (Netlify dev)
1. Installer avhengigheter:
   ```bash
   npm install
   ```
2. Lag `.env` fra `.env.example` og fyll inn nøklene.
3. Start utviklingsserver med funksjoner:
   ```bash
   npm run dev
   ```
4. Åpne URL-en Netlify CLI viser (default http://localhost:8888) og klikk «Oppdater data».

Produksjon: deploy til Netlify (static publish dir `.` + functions `netlify/functions`). All trafikk til `/.netlify/functions/accounts` proxes med access_token/refresh i backend. Ingen tokens sendes til klienten.
