# sparebank1-data-viewer

Statisk frontend som viser kontoer og saldo fra SpareBank 1 via Netlify Function-proxy (ingen secrets i frontend).

## Filstruktur
- `index.html` – dashboard-side.
- `styles.css` – layout/tema for dashboardet.
- `app.js` – UI-logikk som henter data via Netlify Function.
- `netlify/functions/accounts.js` – proxy mot SpareBank 1 konto-API.
- `netlify/functions/_token.js` – tokenhåndtering (cache + refresh).
- `netlify/functions/transactions*.js` – proxyer for transaksjoner (liste, klassifisert, detaljer, eksport).
- `scripts/api/transactionsClient.js` – frontend-klient for transaksjonsendepunkter.
- `.env.example` – env-variabler som må settes lokalt/Netlify.

## Miljøvariabler
Legg inn disse (lokalt i `.env`, i Netlify UI under Site settings → Environment):
- `SB1_CLIENT_ID`
- `SB1_CLIENT_SECRET`
- `SB1_REFRESH_TOKEN`

Legacy-navnene `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` støttes fortsatt som fallback. Tokens roterer og lagres privat i Netlify Blobs (`sb1-oauth/tokens.json`) slik at refresh_token overlever deploys/cold starts.

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

Nullstill token-blob ved behov:
```bash
# viser lagrede tokens
netlify blobs:list sb1-oauth
# slett rotert token (hentes på nytt fra env ved neste kall)
netlify blobs:delete sb1-oauth tokens.json
```

Produksjon: deploy til Netlify (static publish dir `.` + functions `netlify/functions`). All trafikk til `/.netlify/functions/accounts` proxes med access_token/refresh i backend. Ingen tokens sendes til klienten.

## Tester
- Kjør alle tester: `npm test`
- Vitest kjører med jsdom for UI-relaterte tester.
