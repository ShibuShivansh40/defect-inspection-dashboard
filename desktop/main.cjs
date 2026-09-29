/**
 * Electron shell for the dashboard, meant for a factory-floor / edge-device screen.
 *
 * It serves the production build (../dist) from a secure custom origin, app://dashboard, instead of file://.
 * That matters for two features: the MSW service worker (the demo backend) and getUserMedia (the camera in
 * the Labeling Studio) both need a secure origin, and file:// is neither.
 *
 *   npm run build            (in the project root)
 *   cd desktop && npm install && npm start          # windowed
 *   npm run kiosk                                   # fullscreen, no chrome, Esc-proof
 */
const { app, BrowserWindow, net, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.resolve(__dirname, '..', 'dist');
const ORIGIN = 'app://dashboard';
const kiosk = process.argv.includes('--kiosk');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      stream: true,
    },
  },
]);

function resolveFile(urlPath) {
  const file = path.join(DIST, decodeURIComponent(urlPath));
  // Never serve anything outside dist (path traversal).
  if (path.relative(DIST, file).startsWith('..')) return null;
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  // Unknown paths fall back to index.html so client-side routes such as /defects work on reload.
  return exists ? file : path.join(DIST, 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#090c10',
    kiosk,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // The page may only navigate inside its own origin, and never opens new windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });
  win.loadURL(`${ORIGIN}/`);
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const file = resolveFile(new URL(request.url).pathname);
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response('Forbidden', { status: 403 });
  });
  // Only the camera (the Labeling Studio needs it) is granted; every other permission is refused.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === 'media'),
  );
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
