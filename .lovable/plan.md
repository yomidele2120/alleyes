# LENS v2 — Full Upgrade Plan

This is a very large scope (10 feature areas, ~40+ sub-features). I'll build it in **5 sequential phases** so each phase ships in a working state. After you approve, I'll execute Phase 1 immediately; subsequent phases run in follow-up turns (each phase ≈ one large batch of file writes).

I'm flagging upfront where browser limits force a compromise — I'll still build the closest viable alternative as you requested.

---

## Phase 1 — Foundations (data layer, settings, nav, design tokens)

- Extend `face-store.ts`:
  - `Identity` gains: `descriptors: number[][]` (5 angles, averaged at match time), `thumbnail` (dataURL), `group`, `notes`, `detectionCount`, `lastSeen`, `firstEnrolled`.
  - New `detection-log.ts` store (localStorage, capped at 500 entries) with thumbnail, name, feed, time, confidence.
  - New `settings-store.ts` with all Feature 9 toggles + Zustand-style subscribe.
- New `settings.tsx` route implementing every Feature 9 control (threshold slider, toggles, JSON import/export, clear-all, PIN lock).
- New bottom nav (mobile) / sidebar (desktop) — replaces current `LensNav` with: Home, Enroll, Identify, Search, Network, Log, Settings.
- New `Home` dashboard route: enrolled count, feeds active, detections today, last-5 strip, quick-search dropdown.
- Add color tokens `--success` (#22C55E) and `--danger` (#EF4444) to `styles.css` if missing.

## Phase 2 — Recognition engine v2 (always-on labels + AI extras)

- Add `faceExpressionNet`, `ageGenderNet` to loader (toggleable via settings; lazy-loaded to keep cold start fast).
- Rewrite `use-face-recognition.ts`:
  - Always detects ALL faces, returns `age`, `gender`, `expression` when enabled.
  - Matches against averaged descriptor set per identity.
  - Honors confidence threshold from settings.
  - Optionally hides UNIDENTIFIED per settings.
  - Auto-logs detections (throttled per identity, e.g. once per 10s) with snapshot.
- Upgrade `BoundingBox`:
  - 2px rounded, smooth tracking (CSS transitions on transform).
  - Blue pill for known + confidence %, grey pill for UNIDENTIFIED, gold pill for active search target, per-target colored pill in multi-target mode.
  - Age/emotion/gender chips below name pill (driven by settings).
  - Tappable → opens Face Intelligence panel (Feature 6).
- Add `face-intel-panel.tsx` (slide-up sheet) with enrollment photo, stats, age, emotion, current feed, "View Full Profile" link to `/profile/$id`.

## Phase 3 — Multi-angle enrollment + profiles

- Rewrite `enroll.tsx` as a 5-step guided flow: "Look straight" → "Slightly left" → "Slightly right" → "Tilt up" → "Tilt down". Progress bar, text prompt (speechSynthesis for voice prompt, toggleable). Captures one descriptor + thumbnail per step, then "Identity Locked" animation.
- Optional 68-pt landmark mesh overlay during enrollment (canvas drawing over video).
- New `/profile/$id` route: editable name, all 5 thumbnails, count, last-10 sightings (from log), group selector (Family / Team / Watch List / custom), notes, delete, re-enroll.

## Phase 4 — Search mode + Detection log

- New `search.tsx` route (renames/extends current `find.tsx`):
  - Grid of identity cards with checkboxes (single or multi-select).
  - "Begin Search" → camera view.
  - Single target: gold pulsing box, "SCANNING FOR / TARGET LOCATED" banner.
  - Multi target: per-target color palette (gold, blue, green, red, purple, cyan), top strip with status dots, "X of Y TARGETS LOCATED" banner, "ALL TARGETS LOCATED" celebratory state.
- New `log.tsx` route: scrollable timeline (newest first), thumbnail + name + camera + time + confidence cards, filters (name / camera / date / min confidence), CSV export, clear-all confirmation.

## Phase 5 — Network / multi-feed (CCTV)

- New `network.tsx` route: command-center grid (1 / 2 / 2×2 / 2×3 layouts up to 6 feeds).
- Add-camera modal: name, stream URL, optional description, test-connection button.
- Per-tile: name, live face count badge, green/red status dot.
- **Browser-limit honesty:** Pure-browser JS cannot decode RTSP and most IP cameras don't expose CORS-enabled MJPEG, so a raw `rtsp://` URL won't play in `<video>`. I'll support what actually works in a browser and clearly label the rest:
  - `Local Camera` (this device, front/back) ✅
  - HTTP MJPEG streams via `<img>` tag (works only if the camera sends CORS headers) ✅
  - HLS (`.m3u8`) and DASH via `hls.js` ✅
  - WebRTC peer-to-peer "share another device's camera" via a lightweight room (offer/answer copy-paste or via Lovable Cloud signaling if you want a backend) ✅
  - RTSP: shown in the form with a tooltip: "RTSP requires a gateway (e.g. MediaMTX → HLS). Paste the HLS URL instead." I'll document the workaround in-app.
- Face recognition runs on every active tile in parallel (throttled per-tile to keep FPS sane on mobile — probably 2–4 fps per feed depending on count).
- Search integration: when a target is active, any tile that finds them gets a gold border glow + "TARGET FOUND — [Feed Name]" banner + optional alert chime (WebAudio, no asset needed).

---

## Technical notes (for the curious)

- All storage stays in `localStorage` (no backend). Thumbnails are 96×96 JPEGs at ~0.7 quality to keep under the 5 MB quota; log auto-trims to 500 entries.
- AI models load lazily: detector + landmarks + recognition always; age/gender/expression only when their toggles are on (saves ~1 MB initial load).
- Per-feed recognition uses `requestAnimationFrame` + a frame-skip counter scaled by active feed count, so 6 feeds stay responsive on a modern phone.
- PIN lock is local-only (sessionStorage flag + hashed PIN in localStorage) — not real security, just a screen guard.

---

## What I need from you

1. **Approve the plan** and I'll start Phase 1 immediately.
2. **Network feed protocols:** confirm you're OK with HLS / MJPEG / WebRTC instead of raw RTSP (browsers genuinely can't do RTSP). If you have a specific camera, tell me the model and I'll tune the form.
3. **Backend?** Currently 100% on-device. For cross-device WebRTC pairing without copy-pasting SDP, I'd want to enable Lovable Cloud for a tiny signaling table. Say the word and I'll enable it.
