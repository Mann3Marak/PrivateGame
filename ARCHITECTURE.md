# Architecture Document: Local-Play Two-Player Spinner Game
## Version: 1.0
## Date: 2026-03-15
## Author: Systems Architect Agent

## 1. Executive Summary
This MVP will be implemented as a frontend-first web app optimized for shared-device local play, with optional cloud services for media hosting, backups, and lightweight telemetry. Core gameplay (turn alternation, spin logic, round progression, pause/resume) runs fully client-side and persists locally, so the app remains usable without login and with intermittent connectivity.

The recommended low-cost stack is:
- Frontend hosting and API edge layer: Vercel
- Managed database/storage/edge functions: Supabase
- Lightweight operations/admin mirror: Airtable (optional, non-critical path)

This architecture is concrete, fast to build, and fits free-tier constraints while leaving a clean path to production hardening.

## 2. Architecture Overview
### 2.1 Logical Architecture
- `Web Client (Next.js)`:
  - Gameplay UI (`SCR-001`)
  - Dashboard UI (`SCR-002` to `SCR-006`)
  - Game engine (spin execution, turn checks, round progression)
  - Local persistence adapter
- `Local Persistence`:
  - `localStorage` for canonical session/config state (required behavior)
  - `IndexedDB` for optional cached image blobs to avoid localStorage size pressure
- `Vercel Edge/API Layer`:
  - Signed upload URL issuance
  - Optional sync endpoints (backup/restore)
  - Telemetry ingestion
- `Supabase`:
  - Postgres for optional cloud backup and analytics events
  - Storage for spinner images
- `Airtable (Optional)`:
  - Read-friendly mirror of configuration/session summaries for PM/QA without DB access

### 2.2 Runtime Behavior
- Gameplay does not depend on backend round trips.
- Dashboard edits update in-memory state immediately and persist locally on change/blur.
- Cloud calls are asynchronous and non-blocking (best effort), so local gameplay never stalls.
- If local storage is missing/corrupt, app reinitializes with default 4 rounds and fixed quotas.

### 2.3 Deployment Topology
- `Vercel Project`
  - Static/SSR app for all screens
  - Route handlers for `/api/*`
- `Supabase Project`
  - Postgres schema
  - Storage bucket for spinner images
  - Optional edge functions for sync and export
- `Airtable Base` (optional)
  - Synced snapshots via scheduled Supabase function or Vercel cron

## 3. Tech Stack Decisions
| Layer | Choice | Why this choice (MVP/POC) |
|---|---|---|
| Frontend | Next.js + React + TypeScript | Fast iteration, strong ecosystem, easy Vercel deploy |
| UI/State | Zustand + React Hook Form + Zod | Minimal boilerplate, reliable validation, quick dev speed |
| Styling | Tailwind CSS | Rapid responsive implementation across desktop/tablet/mobile |
| Local persistence | localStorage (+ IndexedDB for blobs) | Meets requirement for same-browser restore; simple offline-first behavior |
| Hosting | Vercel | Generous free tier, instant previews, integrated edge/API |
| Backend services | Supabase (Postgres, Storage, Edge Functions) | Big free tier, fast setup, managed auth/storage/database even if auth is off initially |
| Admin mirror (optional) | Airtable | Easy non-technical visibility, quick ops workflows on free tier |
| Observability | Sentry + Vercel Analytics + Supabase logs | Low-friction error/perf visibility for MVP |

### Key Decision Notes
- No mandatory authentication in MVP to match requirements.
- Spinner randomness runs client-side via `crypto.getRandomValues()` for uniformity and low latency.
- Supabase is used for optional resilience (media storage, backup, telemetry), not for critical turn execution.

## 4. Data Model & Storage
### 4.1 Client-Side Canonical Model (localStorage)
`localStorage` key: `spinnerGame.v1.state`
```json
{
  "configVersion": 1,
  "rulesText": "string",
  "rounds": [
    {
      "roundNumber": 1,
      "name": "Round 1",
      "quotaPerPlayer": 10,
      "spinners": {
        "part": [{ "id": "uuid", "text": "string", "imageRef": "string|null" }],
        "action": [{ "id": "uuid", "text": "string", "imageRef": "string|null" }],
        "timer": [{ "id": "uuid", "text": "string", "imageRef": "string|null" }]
      }
    }
  ],
  "session": {
    "isPaused": false,
    "activePlayer": "P1",
    "currentRoundNumber": 1,
    "turnCounters": {
      "1": { "P1": 0, "P2": 0 }
    },
    "lastTurnByPlayer": {
      "P1": { "partText": "string", "actionText": "string", "timerText": "string" },
      "P2": { "partText": "string", "actionText": "string", "timerText": "string" }
    },
    "updatedAt": "ISO-8601"
  }
}
```

### 4.2 Server-Side (Optional Backup/Analytics) in Supabase
- `game_config_snapshots`
  - `id`, `device_id`, `payload_json`, `created_at`
- `session_snapshots`
  - `id`, `device_id`, `payload_json`, `created_at`
- `spin_events`
  - `id`, `device_id`, `session_id`, `round_number`, `player`, `part_text`, `action_text`, `timer_text`, `created_at`
- `spinner_images` (Storage bucket)
  - Public-read or signed-read URLs; max size and mime restrictions enforced

### 4.3 Airtable Mirror (Optional)
- `Configs` table: latest round/rules summary
- `Sessions` table: pause state, current round, updated timestamp
- `Events` table: sampled spin outcomes for QA/PO checks

## 5. API & Integration Design
### 5.1 API Boundaries
Gameplay-critical flows are local-only. API boundaries cover media, backup, and telemetry.

### 5.2 Endpoints (Vercel Route Handlers)
- `POST /api/images/sign-upload`
  - Input: filename, mimeType
  - Output: signed upload URL + public URL
- `POST /api/sync/push`
  - Input: full local state snapshot
  - Behavior: stores `game_config_snapshots` and `session_snapshots`
- `GET /api/sync/pull?deviceId=...`
  - Output: latest snapshot for restore (manual action)
- `POST /api/events/spin`
  - Input: normalized turn event
  - Behavior: inserts telemetry row (async/fire-and-forget)
- `POST /api/airtable/sync` (optional cron/manual)
  - Behavior: upserts latest summaries to Airtable

### 5.3 Integration Rules
- Image upload path:
  1. Modal selects `Upload`
  2. Client requests signed URL
  3. Direct upload to Supabase Storage
  4. `imageRef` saved in local state
- URL mode:
  - Validate absolute URL and allowed image mime extensions before save
- Fail-open principle:
  - If API fails, local gameplay and local save still succeed

## 6. Security & Compliance
### 6.1 Security Controls
- Strict input validation with Zod on client and API
- URL sanitization and protocol allowlist (`https://` only for external images)
- File upload validation: mime type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) and size cap
- CSP headers:
  - Restrict script/style/image origins to app + Supabase + approved domains
- XSS protections:
  - Render rules text as plain text (no HTML execution)
- Rate limiting on public API endpoints (Vercel middleware + Upstash)
- Secret management in Vercel env vars; never expose service role keys client-side

### 6.2 Privacy/Compliance
- No authentication and no required PII in MVP
- Device identifier is random UUID, not user identity
- Data deletion:
  - Local: clear app data action
  - Cloud: delete by `device_id`
- Accessibility target WCAG 2.2 AA retained in frontend implementation

## 7. Scalability & Performance
### 7.1 Performance Strategy
- Client-side spin engine for near-zero latency
- Code-splitting dashboard panels and modal chunks
- Aggressive caching of static assets via Vercel CDN
- Use optimized image sizes/thumbnails to limit storage and render costs
- Debounced autosave to localStorage to avoid main-thread thrashing

### 7.2 Scalability Strategy
- Horizontal scale handled by Vercel/Supabase managed platforms
- Telemetry/event writes are append-only and batchable
- Snapshot storage can be capped with retention policy (e.g., keep latest N per device)
- Airtable sync remains optional and sampled to avoid API quota pressure

### 7.3 Reliability
- App remains fully playable when Supabase/Airtable are unavailable
- Corrupted local state triggers deterministic reset to default 4-round baseline
- Versioned state schema with migration function (`v1 -> v2`) for future updates

## 8. Operational Considerations
### 8.1 Environments
- `dev`: local Next.js + Supabase project
- `preview`: Vercel preview deployments per PR
- `prod`: Vercel production + Supabase production project

### 8.2 CI/CD
- GitHub integration with Vercel previews
- Required checks:
  - Type check
  - Unit tests (game engine and reducers)
  - E2E smoke (spin flow, pause/resume, dashboard edit propagation)
  - Accessibility checks (axe on core screens)

### 8.3 Observability
- Sentry for frontend/runtime exceptions
- Structured API logs with request IDs
- Vercel Web Vitals tracking (LCP, INP, CLS)
- Supabase dashboard alerts for storage/db quota thresholds

### 8.4 Backup/Recovery & Runbooks
- Local-first recovery: rehydrate from localStorage on load
- Optional cloud restore from latest snapshot by `device_id`
- Runbook: if local state invalid, auto-reset + non-blocking banner explaining reset
- Runbook: if image fetch fails, render text and placeholder image state without blocking turns

### 8.5 MVP Scope Guardrails
- Keep gameplay deterministic and local-only for speed/cost control
- Treat cloud sync/telemetry/Airtable as non-blocking enhancements
- Do not add auth/multiplayer until post-POC validation metrics justify complexity