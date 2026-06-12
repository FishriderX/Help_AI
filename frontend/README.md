# AutoHelp 4.0 — Frontend

Browser workspace for the AutoHelp 4.0 game-manual generator.

## Run locally

1. Start the backend (port 3001):
   ```
   cd ../backend && npm start
   ```
2. Start the frontend dev server:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:5173

## Configure

Click ⚙ Settings to set the Backend URL and API Key (defaults: http://localhost:3001 / dev-key-12345). Stored in localStorage.

## Flow

1. Upload symbol/UI images in the Assets panel (right). Backgrounds are removed automatically if the backend has a Remove.bg key.
2. Paste a Google Sheet URL or text in the Document panel (middle), pick language + theme, press Generate.
3. Watch progress in the Assistant panel (left). When status is "Ready for Figma", open the Figma Bridge plugin and press Start Polling to render.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm test` — API client unit tests (Vitest)
- `npm run typecheck` — TypeScript check
