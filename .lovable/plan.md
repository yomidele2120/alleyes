# LENS v3 — Build Plan

Frontend-only build on Lovable. Cloud (Supabase) for storage. External Python/MediaMTX optional — when offline, the existing in-browser face-api.js engine takes over so Identify/Enroll/Search keep working.

## 1. Lovable Cloud schema

Three tables in `public`, RLS on, explicit GRANTs.

- `identities` — id, full_name, nin (unique), id_type, date_of_birth, gender, nationality, photo_url, embedding jsonb, embeddings_multi jsonb, group_tag (staff/vip/watchlist/public), notes, enrolled_at, is_active, owner_id
- `detection_logs` — id, identity_id (nullable for unknowns), full_name, nin, confidence, camera_id, camera_name, snapshot_url, detected_at, age_estimate, gender, owner_id
- `cameras` — id, name, location, rtmp_key (unique per owner), stream_url, is_active, added_at, owner_id

Auth: email/password + Google (via Lovable broker). Routes that mutate data live under `_authenticated/`. Public dashboard read uses `requireSupabaseAuth` server fns.

Storage bucket `lens-snapshots` for enrollment photos + detection snapshots.

## 2. Backend client (`src/lib/lens-backend.ts`)

Thin wrapper around `VITE_BACKEND_URL` + `VITE_WS_URL` (configurable in Settings, persisted to localStorage; defaults `http://localhost:8000` / `ws://localhost:3001`).

- `health()` → polls `/api/health`; sets `backendOnline` global store
- `enroll(payload)` / `enrollBulk(csv)` / `identify(blob)` / `setTargets(ids[])`
- WebSocket client with reconnect/backoff; emits typed events: `detection`, `target_found`, `camera_status`
- On any fetch failure → mark offline, surface toast, frontend switches to face-api.js path

## 3. Engine router (`src/lib/recognition-engine.ts`)

Single API for the UI:
- `recognize(frame) → Detection[]`
- If backend online → POST `/api/identify` with JPEG blob
- Else → existing `use-face-recognition` (face-api.js) pipeline
- Identities loaded from Supabase either way; embeddings field used by face-api fallback when present

## 4. Screens (TanStack routes)

```
/                       Dashboard home (stats, recent, quick search, system status)
/live                   Camera grid (HLS via hls.js + overlay canvas)
/search                 Targets + status board + mini grid
/identities             Table + add/bulk modals
/identities/$id         Profile + history + add-angles
/log                    Detection log (filters, CSV export)
/cameras                Camera list + add modal with copyable RTMP/HLS URLs
/settings               Recognition/Alert/Data/Server settings
/auth                   Sign in (email + Google)
```

All under `_authenticated/` except `/auth`. Existing `enroll`/`identify`/`search` immersive flows kept and linked from new screens.

## 5. Components

- `lens-sidebar.tsx` / `lens-bottom-nav.tsx` — replaces current `lens-nav`
- `camera-tile.tsx` — HLS player + canvas overlay + status pills
- `detection-overlay.tsx` — box colors by group (blue/grey/red/gold), pulse for watchlist/target
- `identity-card.tsx`, `identity-table.tsx`, `bulk-import-modal.tsx`, `add-identity-modal.tsx`
- `target-board.tsx`, `target-picker.tsx`
- `system-status.tsx` (backend/model/ws/streams indicators)
- `toast-stream.tsx` — global watchlist/target sounds + stacked toasts

## 6. Design tokens

Apply spec palette in `src/styles.css` as semantic tokens (`--bg`, `--surface`, `--accent`, `--gold`, `--success`, `--danger`, `--warning`, `--text`, `--muted`). Cormorant for the wordmark, Inter for UI (via `@fontsource`). 14px card radius, 8px button radius, frosted glass overlay class, 200ms transitions. No hardcoded hex in components.

## 7. Settings store extensions

Extend `settings-store.ts` with: similarity threshold, label min-confidence, fps, show unknowns/age/gender, sound on target, sound on watchlist, desktop notifications, backend URL, mediamtx URL, ws URL. Test-connection buttons.

## 8. CSV bulk import

CSV template download, paper-parse client side, batch POST to `/api/enroll/bulk` if backend online; else fallback path enrolls one-by-one in-browser using face-api.js and Supabase insert.

## 9. Out of scope (your infra)

I'll **not** generate Python/MediaMTX/Docker files this round (you chose frontend-only). When you're ready to stand up the Python side, ask me to "scaffold the LENS Python backend" and I'll add `backend/` + `mediamtx.yml` + `docker-compose.yml` + README as repo files.

## Technical notes

- Cloud Supabase clients per `tanstack-supabase-integration`: browser client in components, `requireSupabaseAuth` in server fns, `supabaseAdmin` only inside handler dynamic imports (none needed for v1).
- HLS playback: `bun add hls.js`. Safari uses native HLS.
- Audio alerts: small base64 wav, gated by settings.
- WebSocket lives in a React context provider mounted in `__root.tsx` so all screens share one connection.
- Engine auto-fallback decision is reactive — health poll every 15s + on every failed request.

## Build order

1. Enable Cloud + schema + auth + storage bucket
2. Tokens, fonts, sidebar/bottom-nav shell
3. Backend client + WS provider + health/engine router
4. Identities CRUD + Add/Bulk modals + Profile page
5. Cameras CRUD + HLS tile + Live grid
6. Search & Track + target board
7. Detection log + export
8. Dashboard stats + recent strip
9. Settings (recognition + server URLs + test connection)
10. Wire watchlist/target sounds + toasts
