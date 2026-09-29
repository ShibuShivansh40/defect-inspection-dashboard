# Defect Inspection Dashboard

Real-time defect inspection dashboard and labeling studio for a factory line: **React, TypeScript, React Query, Canvas, ONNX.**

**[Live demo →](https://d2ap1twsm9bjpd.cloudfront.net)**

<!-- Replace with a 15–20 s GIF: threshold slider moving, then one station dropping offline and recovering. -->

![Demo](docs/demo.gif)

## What is real and what is simulated

| Part                      | Status                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Detections and confidence | **Real.** YOLOv8n predictions on held-out NEU-DET frames (see [Model](#model)).           |
| Auto-label in the Studio  | **Real.** The same model runs in your browser with ONNX Runtime Web; nothing is uploaded. |
| Camera in the Studio      | **Real.** `getUserMedia`, with a device picker and frame capture.                         |
| Live-line camera feeds    | Simulated. Dataset images are replayed as if four cameras captured them.                  |
| Edge API, outages, 503s   | Simulated in the browser by a service worker (MSW), so the site deploys as static files.  |

## Features

- **Live line** (`/`): four camera stations, each polling its latest frame every second. Defect boxes, class labels and confidence are drawn on an HTML Canvas, with a PASS/FAIL verdict per frame.
- **Station detail** (`/stations/:id`): one camera at full size, a reject-threshold slider that re-filters boxes live, and a scrubber over the last 50 frames (pause, step, go live).
- **Defect log** (`/defects`): an Ant Design table of every detection this shift, with class, station and time filters and server-side pagination. Click a row to open that frame with its box highlighted.
- **Labeling studio** (`/studio`): add images, capture from a camera or load samples; draw, move, resize, relabel and delete boxes on an interactive Canvas with undo and redo; let the model propose boxes and accept them; export a YOLO dataset zip or COCO JSON.
- **Shift stats** on every page: units inspected, defect rate, defects per class, and station health (online / degraded / offline, latency).
- **Two themes**, Graphite (dark) and Daylight (light), from one set of design tokens.

It also includes loading skeletons, empty and error states with retry, a responsive layout down to 375 px, keyboard-operable controls, and a verdict shown as text as well as colour.

## Model

A YOLOv8n model fine-tuned from the COCO-pretrained weights on the NEU-DET steel-surface dataset (six classes). Training and evaluation code is in [`ml/`](ml/README.md).

| Held-out set | mAP50 | mAP50-95 | Precision | Recall |
| ------------ | ----- | -------- | --------- | ------ |
| 48 images    | 0.69  | 0.43     | 0.60      | 0.73   |

Per-class mAP50: pitted surface 0.99, inclusion 0.86, patches 0.85, scratches 0.84, rolled-in scale 0.44, crazing 0.18.

**Read these numbers with care.**

- The dataset used here is small: 240 images, of which 192 train the model and 48 are held out and never seen in training. Metrics come from those 48 images only, so they are a rough estimate.
- Crazing is labelled as a box over most of the image, and rolled-in scale is visually subtle; the model is weak on both. That is visible in the dashboard, where some frames get no detection.
- NEU-DET has no defect-free images. A PASS frame in the dashboard therefore means "the model reported nothing above the threshold", which includes misses, not "the steel is good".
- The simulated line shows **only the 48 held-out frames**, so every box you see is an out-of-sample prediction. Shift totals and the defect log count detections at 50% confidence; the slider (25–99%) changes what is drawn and the verdict.

The model is exported to ONNX (`public/models/defect-yolov8n.onnx`, 12 MB) and lazy-loaded only when you press Auto-label in the Studio.

## Architecture

```
 Browser
 ┌──────────────────────────────────────────────────────────────────────┐
 │  React pages ──► React Query hooks ──► fetch('/api/…')               │
 │      ▲               (cache, polling,        │                       │
 │      │                retry, backoff)        ▼                       │
 │  Zustand (threshold, theme,      MSW service worker                  │
 │   filters, studio boxes:         = simulated edge API                │
 │   UI state only)                 replays real model predictions      │
 │                                                                      │
 │  Studio ──► ONNX Runtime Web (WASM) ──► YOLOv8n detections           │
 └──────────────────────────────────────────────────────────────────────┘
        static files on S3 + CloudFront, deployed by GitHub Actions
```

**Server state lives only in React Query. Client state lives only in Zustand.** Frames, stations, stats and defects are server data: React Query owns their caching, polling, retries and staleness. Zustand holds only what the user chose (the threshold, the theme, the log filters and the Studio's images, boxes and undo history). Components select narrow slices (`useUi((s) => s.threshold)`), so moving the slider re-renders the canvases and nothing else.

## Engineering decisions

- **One query per station.** Each `StationCard` owns its `useLatestFrame(id)` query, so a slow or offline camera never blocks the other three.
- **Polling with backoff.** `refetchInterval` is 1 s normally and 5 s while a station is erroring. Polling stops in a hidden tab.
- **`keepPreviousData`.** The last frame stays on screen while the next one loads, and the table doesn't flash empty between pages. Filters are part of the query key, so every filter set is cached and refetched automatically.
- **DPR-aware Canvas.** Boxes are stored in source-image pixels, scaled by `canvasWidth / imageWidth`, and drawn at `devicePixelRatio` so lines stay sharp on retina screens. A `ResizeObserver` keeps them aligned when the layout changes. Canvas rather than SVG, because four streams redraw every second with no per-box DOM nodes.
- **Decoded-image cache.** Images are cached in a `Map` keyed by URL, so scrubbing never re-downloads a frame.
- **Interactive annotation.** Pointer events with pointer capture handle draw, move and resize; hit-testing, resizing and clamping are pure functions in `src/lib/geometry.ts`, covered by unit tests. Undo and redo are per-image snapshot stacks. The box list beside the canvas and the keyboard shortcuts give a non-pointer way to do everything.
- **In-browser inference.** ONNX Runtime Web runs the model on the WASM backend in the page. It and the model load on first use, so the rest of the app never pays for them. Decoding the YOLO head and non-maximum suppression are unit-tested pure functions.
- **Dependency-free export.** The YOLO zip is written by a small store-only ZIP writer (`src/lib/zip.ts`) rather than a library.
- **Code splitting.** Each page is `React.lazy`, so the Live Line never ships the Ant Design table (the largest chunk) or the Studio.
- **Design tokens.** Both themes are CSS variables behind semantic names (`bg-panel`, `text-muted`); a script in `index.html` sets the theme before first paint, so there is no flash.
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

`scripts/build_manifest.py` converts the Pascal VOC XML annotations into `src/mocks/manifest.json`. Those labelled boxes are the training and evaluation labels, and they are what the Studio's Auto-label is compared against by eye.

## Tests

```bash
npm test          # Vitest: geometry, YOLO decoding and NMS, ZIP and label export, mock engine
```

23 unit tests cover box hit-testing, resizing and clamping, IoU, tensor decoding and NMS, the ZIP writer (including the CRC-32 check value), YOLO and COCO export, the deterministic mock engine and its outage cycle, and the guarantee that only held-out frames are shown. CI runs them before every build.

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
npm test
```

Requires Node 22.22 or newer (React Router 8 and MSW 3 need it). The camera needs HTTPS or `localhost`.

## Deploy (S3 + CloudFront via GitHub Actions)

`.github/workflows/deploy.yml` lints, format-checks, tests and builds on every push to `main`, then syncs `dist/` to a **private** S3 bucket behind CloudFront (Origin Access Control). AWS credentials come from **GitHub OIDC**; no keys are stored in the repo. The IAM role trusts only `refs/heads/main` of this repo and is least-privilege: `s3:ListBucket`, `s3:PutObject` and `s3:DeleteObject` on this bucket, plus `cloudfront:CreateInvalidation` on this distribution. Hashed assets are cached for a year; `index.html` and the service worker are `no-cache`, and the model file is cached for an hour. CloudFront maps 403/404 to `/index.html` (200) so deep links work.

Repo secrets: `AWS_ROLE_ARN`, `BUCKET`, `CF_DIST_ID`.

## Desktop build (Electron)

[`desktop/`](desktop/README.md) is a small Electron shell for an edge device or factory-floor screen. It serves the production build from a secure custom origin so the service worker and the camera work, refuses paths outside `dist/`, and grants only the camera permission. It has its own `package.json`, so the web build and CI never download Electron.

## Stack

Vite · React 19 · TypeScript (strict) · TanStack Query · Zustand · React Router · Tailwind CSS · Ant Design (Table only) · Canvas 2D · MSW · ONNX Runtime Web · Ultralytics YOLOv8 · Vitest · Electron

## Roadmap

- WebSocket / SSE push behind a toggle (polling vs push trade-off)
- Real inference service (FastAPI) instead of replaying predictions on the simulated line
- Train on the full NEU-DET set (1,800 images) and report metrics on a larger held-out split
- Component tests (React Testing Library) and a Playwright smoke test after each deploy
- Defect-rate trend chart
