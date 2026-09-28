# Defect Inspection Dashboard

Real-time defect inspection dashboard for a factory line: **React, TypeScript, React Query, Canvas.**

**[Live demo →](https://d2ap1twsm9bjpd.cloudfront.net)**

<!-- Replace with a 15–20 s GIF: threshold slider moving, then one station dropping offline and recovering. -->

![Demo](docs/demo.gif)

## Features

- **Live line** (`/`): four camera stations, each polling its latest frame every second. Defect boxes, class labels and confidence are drawn on an HTML Canvas, with a PASS/FAIL verdict per frame.
- **Station detail** (`/stations/:id`): one camera at full size, a reject-threshold slider that re-filters boxes live, and a scrubber over the last 50 frames (pause, step, go live).
- **Defect log** (`/defects`): an Ant Design table of every detection this shift, with class, station and time filters and server-side pagination. Click a row to open that frame with its box highlighted.
- **Shift stats** on every page: units inspected, defect rate, defects per class, and station health (online / degraded / offline, latency).

It also includes loading skeletons, empty and error states with retry, a responsive layout down to 375 px, keyboard-operable controls, and a verdict shown as text as well as colour.

## Architecture

```
 Browser
 ┌───────────────────────────────────────────────────────────────┐
 │  React pages ──► React Query hooks ──► fetch('/api/…')        │
 │      ▲               (cache, polling,        │                │
 │      │                retry, backoff)        ▼                │
 │  Zustand (threshold,              MSW service worker          │
 │   filters: UI state only)         = simulated edge API        │
 └───────────────────────────────────────────────────────────────┘
        static files on S3 + CloudFront, deployed by GitHub Actions
```

**Server state lives only in React Query. Client state lives only in Zustand.** Frames, stations, stats and defects are server data: React Query owns their caching, polling, retries and staleness. Zustand holds only what the user chose (the threshold and the log filters). Components select narrow slices (`useUi((s) => s.threshold)`), so moving the slider re-renders the canvases and nothing else.

## Engineering decisions

- **One query per station.** Each `StationCard` owns its `useLatestFrame(id)` query, so a slow or offline camera never blocks the other three.
- **Polling with backoff.** `refetchInterval` is 1 s normally and 5 s while a station is erroring. Polling stops in a hidden tab.
- **`keepPreviousData`.** The last frame stays on screen while the next one loads, and the table doesn't flash empty between pages. Filters are part of the query key, so every filter set is cached and refetched automatically.
- **DPR-aware Canvas.** Boxes are stored in source-image pixels, scaled by `canvasWidth / imageWidth`, and drawn at `devicePixelRatio` so lines stay sharp on retina screens. A `ResizeObserver` keeps them aligned when the layout changes. Canvas rather than SVG, because four streams redraw every second with no per-box DOM nodes.
- **Decoded-image cache.** Images are cached in a `Map` keyed by URL, so scrubbing never re-downloads a frame.
- **Code splitting.** Each page is `React.lazy`, so the Live Line never ships the Ant Design table (the largest chunk).
- **Why MSW rather than a server.** The mock edge API runs in the browser as a service worker, so the app makes real `fetch` calls against REST endpoints and still deploys as static files. It stays enabled in the production build on purpose, because it is the demo's backend. The cost is a larger startup chunk, which a real backend removes.

### Mock REST API

| Endpoint                                                   | Returns                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `GET /api/stations`                                        | `Station[]` with status and latency that drift over time |
| `GET /api/stations/:id/latest`                             | `Frame` (503 while the camera is offline)                |
| `GET /api/stations/:id/frames?limit=50`                    | `Frame[]`, the history for the scrubber                  |
| `GET /api/frames/:id`                                      | one `Frame`                                              |
| `GET /api/defects?cls=&station=&from=&to=&page=&pageSize=` | `{ items: DefectRow[]; total }`                          |
| `GET /api/stats`                                           | shift totals and per-class counts                        |

Every response waits a random 50–300 ms, and about 2% return a 503. Every two minutes one station goes offline for 20 s, then runs degraded for 15 s. This exercises retries, error states and the station-health UI.

## Data note

Frames are from the **NEU-DET** steel-surface defect dataset (K. Song and Y. Yan, Northeastern University, China). The dataset has 6 classes: crazing, inclusion, patches, pitted surface, rolled-in scale and scratches. This repo uses 240 images (40 per class) and is non-commercial.

**Detections are the dataset's labelled boxes, not model output.** Confidence is simulated: a deterministic value in [0.55, 0.99) hashed from the frame id, so a reload shows the same numbers. About half the frames come back with no detections, so there are PASS frames. A real YOLOv8 inference service is on the roadmap.

`scripts/build_manifest.py` converts the Pascal VOC XML annotations into `src/mocks/manifest.json`.

## Lighthouse (mobile, live URL)

| Performance | Accessibility | Best Practices | SEO |
| ----------- | ------------- | -------------- | --- |
| –           | –             | –              | –   |

## Run locally

```bash
npm i && npm run dev      # http://localhost:5173
npm run build && npm run preview
npm run lint              # oxlint
npm run typecheck
```

Requires Node 20.19+ (or 22.12+).

## Deploy (S3 + CloudFront via GitHub Actions)

`.github/workflows/deploy.yml` builds on every push to `main` and syncs `dist/` to a **private** S3 bucket behind CloudFront (Origin Access Control). AWS credentials come from **GitHub OIDC**; no keys are stored in the repo. The IAM role trusts only `refs/heads/main` of this repo and is least-privilege: `s3:ListBucket`, `s3:PutObject` and `s3:DeleteObject` on this bucket, plus `cloudfront:CreateInvalidation` on this distribution. Hashed assets are cached for a year; `index.html` and the service worker are `no-cache`. CloudFront maps 403/404 to `/index.html` (200) so deep links work.

Repo secrets: `AWS_ROLE_ARN`, `BUCKET`, `CF_DIST_ID`.

## Stack

Vite · React 19 · TypeScript (strict) · TanStack Query · Zustand · React Router · Tailwind CSS · Ant Design (Table only) · Canvas 2D · MSW

## Roadmap

- WebSocket / SSE push behind a toggle (polling vs push trade-off)
- Real YOLOv8 inference service (FastAPI) replacing the mock
- Electron kiosk build
- Framer Motion route transitions and new-defect toasts
- Defect-rate trend chart
- Vitest + RTL tests for box-scaling maths and filters
