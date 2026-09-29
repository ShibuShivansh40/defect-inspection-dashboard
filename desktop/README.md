# Desktop (Electron) build

A thin Electron shell that runs the production build on an edge device or factory-floor screen.

```bash
npm run build                 # project root: creates dist/
cd desktop
npm install
npm start                     # normal window
npm run kiosk                 # fullscreen kiosk mode
```

Why a custom `app://` origin rather than `file://`: the mock API (MSW service worker) and the camera in the
Labeling Studio both need a secure origin. The shell serves `dist/` itself, falls back to `index.html` for
client-side routes, refuses paths outside `dist/`, grants only the camera permission, and blocks navigation
away from the app.

It lives in its own folder with its own `package.json`, so the web build and CI never download Electron.
