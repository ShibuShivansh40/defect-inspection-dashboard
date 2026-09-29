import { useEffect, useRef, useState } from 'react';
import { AnnotatorCanvas } from '../components/studio/AnnotatorCanvas';
import { CameraCapture } from '../components/studio/CameraCapture';
import { Card, EmptyState } from '../components/ui';
import { loadImage } from '../hooks/canvas';
import { detect } from '../lib/detector';
import { cocoJson, yoloZip, type LabelledImage } from '../lib/exporters';
import { CLASS_COLORS, CLASS_LABELS } from '../lib/format';
import { round } from '../lib/geometry';
import { selectCurrent, useStudio, type NewImage } from '../store/studio';
import { DEFECT_CLASSES } from '../types';
import split from '../../ml/split.json';

async function fromBlob(name: string, blob: Blob, source: NewImage['source']): Promise<NewImage> {
  const bmp = await createImageBitmap(blob);
  const item = { name, blob, width: bmp.width, height: bmp.height, source };
  bmp.close();
  return item;
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Held-out frames: images the detector never saw during training, one per defect class. */
const SAMPLE_IDS = split.val.filter((_, i) => i % 8 === 0);

export default function Studio() {
  const images = useStudio((s) => s.images);
  const current = useStudio(selectCurrent);
  const selectedId = useStudio((s) => s.selectedId);
  const activeClass = useStudio((s) => s.activeClass);
  const store = useStudio;

  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState<null | 'auto' | 'export' | 'samples'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [minConf, setMinConf] = useState(0.3);
  const fileInput = useRef<HTMLInputElement>(null);

  // [ and ] switch images from anywhere on the page, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '[') store.getState().step(-1);
      if (e.key === ']') store.getState().step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return setMessage('Choose image files (JPEG, PNG, WebP).');
    const items = await Promise.all(list.map((f) => fromBlob(f.name, f, 'upload')));
    store.getState().addImages(items);
    setMessage(null);
  };

  const loadSamples = async () => {
    setBusy('samples');
    try {
      const items = await Promise.all(
        SAMPLE_IDS.map(async (id) => {
          const res = await fetch(`${import.meta.env.BASE_URL}frames/${id}.jpg`);
          if (!res.ok) throw new Error(`Could not load ${id}`);
          return fromBlob(`${id}.jpg`, await res.blob(), 'sample');
        }),
      );
      store.getState().addImages(items);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load samples.');
    } finally {
      setBusy(null);
    }
  };

  const autoLabel = async () => {
    if (!current) return;
    setBusy('auto');
    setMessage(null);
    try {
      const img = await loadImage(current.url);
      const found = (await detect(img, minConf)).map(round);
      const manual = current.boxes.filter((b) => b.conf === undefined);
      store.getState().replaceBoxes([...manual, ...found]);
      setMessage(
        found.length
          ? `Model proposed ${found.length} box(es). Review them, then accept.`
          : 'The model found nothing at this confidence.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? `Auto-label failed: ${e.message}` : 'Auto-label failed.');
    } finally {
      setBusy(null);
    }
  };

  const acceptAll = () => {
    if (!current) return;
    store.getState().replaceBoxes(current.boxes.map(({ conf: _conf, ...b }) => b));
  };

  const labelled = (): LabelledImage[] =>
    images.map((im) => ({
      name: im.name,
      width: im.width,
      height: im.height,
      blob: im.blob,
      boxes: im.boxes.map(round),
    }));

  const exportYolo = async () => {
    setBusy('export');
    try {
      download('labeling-studio-yolo.zip', await yoloZip(labelled()));
    } finally {
      setBusy(null);
    }
  };
  const exportCoco = () =>
    download(
      'labeling-studio-coco.json',
      new Blob([JSON.stringify(cocoJson(labelled()), null, 1)], { type: 'application/json' }),
    );

  const totalBoxes = images.reduce((n, im) => n + im.boxes.length, 0);
  const unreviewed = images.reduce((n, im) => n + im.boxes.filter((b) => b.conf !== undefined).length, 0);
  const btn =
    'rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-40';

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-5 lg:px-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles(e.dataTransfer.files);
      }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Labeling studio</h1>
          <p className="text-sm text-muted">
            Capture or add frames, draw and correct defect boxes, let the model propose labels, then export a
            training set.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => e.target.files && void addFiles(e.target.files)}
          />
          <button type="button" className={btn} onClick={() => fileInput.current?.click()}>
            Add images
          </button>
          <button type="button" className={btn} onClick={() => setCamera((v) => !v)} aria-pressed={camera}>
            {camera ? 'Hide camera' : 'Use camera'}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => void loadSamples()}
            disabled={busy === 'samples'}
          >
            Load sample frames
          </button>
        </div>
      </div>

      {message && (
        <p role="status" className="mb-3 rounded-md border border-line bg-panel px-3 py-2 text-xs text-muted">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          <h2 className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Images ({images.length})
          </h2>
          {images.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted">Drop images here, or add some above.</p>
          ) : (
            <ul className="space-y-1.5">
              {images.map((im) => (
                <li key={im.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => store.getState().setCurrent(im.id)}
                    aria-current={im.id === current?.id}
                    className={`flex w-full items-center gap-2 rounded-lg border p-1.5 text-left ${
                      im.id === current?.id
                        ? 'border-accent bg-accent/10'
                        : 'border-transparent hover:bg-ink/5'
                    }`}
                  >
                    <img src={im.url} alt="" className="size-10 rounded object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-ink">{im.name}</span>
                      <span className="text-[11px] text-muted">
                        {im.boxes.length === 1 ? '1 box' : `${im.boxes.length} boxes`}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${im.name}`}
                    onClick={() => store.getState().removeImage(im.id)}
                    className="absolute top-1 right-1 hidden rounded px-1 text-xs text-muted group-hover:block hover:text-bad focus-visible:block"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="min-w-0 space-y-3">
          {camera && (
            <CameraCapture
              onCapture={(img) => {
                store.getState().addImages([img]);
                store.getState().setCurrent(store.getState().images.at(-1)!.id);
              }}
              onClose={() => setCamera(false)}
            />
          )}
          {current ? (
            <div className="mx-auto w-full max-w-[640px]">
              <AnnotatorCanvas />
            </div>
          ) : (
            <Card>
              <EmptyState
                title="No image yet"
                message="Add images, use the camera, or load sample frames to start labelling."
              />
            </Card>
          )}
          {current && (
            <p className="text-xs text-muted">
              Drag on the image to draw a box. Click a box to select it, drag to move, drag a handle to
              resize. Keys: 1–6 class, arrows nudge, Delete removes, Ctrl+Z undo, [ and ] switch image.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Card className="p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Class</h2>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Active class">
              {DEFECT_CLASSES.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={activeClass === c}
                  onClick={() => {
                    store.getState().setActiveClass(c);
                    store.getState().relabelSelected(c);
                  }}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                    activeClass === c
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: CLASS_COLORS[c] }}
                  />
                  <span className="truncate">{CLASS_LABELS[c]}</span>
                  <kbd className="ml-auto text-[10px] text-muted">{i + 1}</kbd>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={btn}
                onClick={() => store.getState().undo()}
                disabled={!current?.undo.length}
              >
                Undo
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => store.getState().redo()}
                disabled={!current?.redo.length}
              >
                Redo
              </button>
              <button
                type="button"
                className={`${btn} ml-auto`}
                onClick={() => store.getState().replaceBoxes([])}
                disabled={!current?.boxes.length}
              >
                Clear
              </button>
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Auto-label</h2>
            <p className="mb-2 text-xs text-muted">
              Runs the YOLOv8n detector in your browser. Proposals are dashed until you accept them.
            </p>
            <label className="mb-2 flex items-center gap-2 text-xs text-muted">
              Min confidence
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={minConf}
                onChange={(e) => setMinConf(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <output className="w-9 text-right tabular-nums text-ink">{Math.round(minConf * 100)}%</output>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${btn} flex-1`}
                onClick={() => void autoLabel()}
                disabled={!current || busy === 'auto'}
              >
                {busy === 'auto' ? 'Detecting…' : 'Auto-label this image'}
              </button>
              <button
                type="button"
                className={btn}
                onClick={acceptAll}
                disabled={!current?.boxes.some((b) => b.conf !== undefined)}
              >
                Accept all
              </button>
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Boxes ({current?.boxes.length ?? 0})
            </h2>
            {!current || current.boxes.length === 0 ? (
              <p className="text-xs text-muted">No boxes on this image.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {current.boxes.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => store.getState().select(b.id)}
                      aria-pressed={selectedId === b.id}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                        selectedId === b.id ? 'bg-ink/10 text-ink' : 'text-muted hover:text-ink'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-sm"
                        style={{ background: CLASS_COLORS[b.cls] }}
                      />
                      <span className="flex-1 truncate">{CLASS_LABELS[b.cls]}</span>
                      <span className="tabular-nums">
                        {Math.round(b.w)}×{Math.round(b.h)}
                      </span>
                      {b.conf !== undefined && (
                        <span className="tabular-nums">{Math.round(b.conf * 100)}%</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className={`${btn} mt-2 w-full`}
              onClick={() => store.getState().deleteSelected()}
              disabled={!selectedId}
            >
              Delete selected
            </button>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Export</h2>
            <p className="mb-2 text-xs text-muted tabular-nums">
              {images.length} images · {totalBoxes} boxes
              {unreviewed > 0 && <span className="text-warn"> · {unreviewed} unreviewed proposals</span>}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${btn} flex-1`}
                onClick={() => void exportYolo()}
                disabled={images.length === 0 || busy === 'export'}
              >
                YOLO zip
              </button>
              <button
                type="button"
                className={`${btn} flex-1`}
                onClick={exportCoco}
                disabled={images.length === 0}
              >
                COCO JSON
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              The zip has images/, labels/ and data.yaml, ready for <code>ml/train.py --data</code>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
