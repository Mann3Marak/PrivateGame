# Local-Play Two-Player Spinner Game

## Project Purpose and Scope
Browser-based local two-player spinner game with a no-auth dashboard for live configuration.

Implemented through Sprint 3:
- Sprint 1: deterministic local gameplay engine, pause/resume, resilient local persistence.
- Sprint 2: round/rules/spinner configuration with validation and safe image URL fallback.
- Sprint 3: signed media upload flow, security hardening, telemetry ingestion, and CI quality gates.

## Setup
Prerequisites:
- Node.js 20+
- npm 10+

Install:
```bash
npm install
```

Run locally:
```bash
npm run dev
```

Build and start:
```bash
npm run build
npm run start
```

## Verification Commands
```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:a11y
npm run ci:check
```

## Environment Variables
Required for Supabase upload + telemetry persistence:
- `SUPABASE_URL` - Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side service role key (must never be exposed client-side).

Optional:
- `SUPABASE_STORAGE_BUCKET` - Storage bucket for spinner uploads (default: `spinner-images`).
- `SUPABASE_UPLOAD_MAX_BYTES` - Max upload bytes accepted by API (default: `5242880`).
- `TELEMETRY_DISABLED` - Set `true` to accept events but skip persistence.

## Usage and Safety Notes
- State persists in `localStorage` key `spinnerGame.v1.state`.
- Image upload is fail-open: upload errors never block text-based gameplay or spinner saves.
- Telemetry is fire-and-forget (`sendBeacon`/`fetch keepalive`) and never blocks spin execution.
- API inputs are validated with Zod and text inputs are sanitized at mutation/API boundaries.
- CSP and secure response headers are applied through middleware.
- Public API endpoints use server-side rate limiting.

## Dependencies
Installed top-level versions from `package-lock.json`.

Runtime dependencies:
- `@supabase/supabase-js` `2.99.1`
- `next` `16.1.6`
- `react` `19.2.4`
- `react-dom` `19.2.4`
- `react-hook-form` `7.71.2`
- `zod` `4.3.6`
- `zustand` `5.0.11`

Dev dependencies:
- `@axe-core/playwright` `4.11.1`
- `@playwright/test` `1.58.2`
- `@tailwindcss/postcss` `4.2.1`
- `@testing-library/jest-dom` `6.9.1`
- `@testing-library/react` `16.3.2`
- `@types/node` `24.12.0`
- `@types/react` `19.2.14`
- `@types/react-dom` `19.2.3`
- `@vitest/coverage-v8` `3.2.4`
- `autoprefixer` `10.4.27`
- `eslint` `9.39.4`
- `eslint-config-next` `16.1.6`
- `jsdom` `27.4.0`
- `postcss` `8.5.8`
- `tailwindcss` `4.2.1`
- `typescript` `5.9.3`
- `vitest` `3.2.4`
