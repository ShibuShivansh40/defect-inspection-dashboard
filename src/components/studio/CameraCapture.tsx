import { useEffect, useRef, useState } from 'react';
import type { NewImage } from '../../store/studio';

/** Live camera preview with a capture button. The stream is stopped as soon as the panel closes. */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (img: NewImage) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser has no camera API, or the page is not served over HTTPS.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        if (video.current) video.current.srcObject = stream;
        setReady(true);
        // Labels are only available after permission has been granted.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter((d) => d.kind === 'videoinput'));
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow it in the browser and try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'Could not start the camera.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        onCapture({ name: `capture-${stamp}.jpg`, blob, width: c.width, height: c.height, source: 'camera' });
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div className="rounded-xl border border-line bg-panel p-3 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Camera</h2>
        {devices.length > 1 && (
          <select
            aria-label="Camera device"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={onClose} className="ml-auto text-xs text-muted hover:text-ink">
          Close camera
        </button>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : (
        <>
          <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-lg bg-black" />
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="mt-2 w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            Capture frame
          </button>
        </>
      )}
    </div>
  );
}
