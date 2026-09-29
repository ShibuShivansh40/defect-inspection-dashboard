import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/inter';
import './index.css';

/**
 * The mock edge API (MSW) runs in production too: it is this demo's backend.
 * It must be registered before React renders so the first fetch is intercepted.
 */
async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: import.meta.env.PROD,
  });
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
