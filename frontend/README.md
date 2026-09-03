# Frontend — Oregon Fire & Air Dashboard

Vite + React + TypeScript single-page app. This scaffold ships a minimal placeholder shell with
the i18n provider wired; the map, incident detail, air quality, and relief surfaces arrive in
later PRs (see the V1 specification).

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm test` — Vitest (Testing Library + axe), single run for CI
- `npm run test:watch` — Vitest in watch mode

## API base

The client calls the API same-origin by default (`/api/...`): the FastAPI service serves
the built SPA for hosted previews (`SPA_DIST_DIR`, see `api/README.md`), and the Vite dev
server proxies `/api` and `/healthz` to `localhost:8000` in development. Set
`VITE_API_BASE_URL` to target a split-origin API instead.


## i18n

`react-i18next` is initialized in `src/i18n` with empty `en` and `es` translation namespaces.
Surfaces register their strings per PR to keep EN/ES parity reviewable.
