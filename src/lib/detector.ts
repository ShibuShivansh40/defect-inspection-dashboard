import { INPUT_SIZE, decodeYolo, nms, toBoxes } from './yolo';
import type { Box } from './geometry';

/**
 * In-browser inference with onnxruntime-web (WASM). The runtime (bundled by Vite as its own chunk) and the model are loaded on first use,
 * so the rest of the app never pays for them. Nothing leaves the browser.
 */
const BASE = import.meta.env.BASE_URL;

type Session = import('onnxruntime-web').InferenceSession;
let session: Promise<Session> | null = null;

function load(): Promise<Session> {
  session ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1; // multi-threading needs cross-origin isolation, which static hosting lacks
    return ort.InferenceSession.create(`${BASE}models/defect-yolov8n.onnx`, { executionProviders: ['wasm'] });
  })().catch((e) => {
    session = null; // allow a retry
    throw e;
  });
  return session;
}

export const warmUp = () => load().then(() => undefined);

/** Run the detector on an image and return boxes in source-image pixels. */
export async function detect(image: HTMLImageElement, minConf = 0.25): Promise<Box[]> {
  const [s, ort] = await Promise.all([load(), import('onnxruntime-web/wasm')]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  // RGBA bytes -> planar RGB floats in [0, 1]
  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4] / 255;
    input[plane + i] = data[i * 4 + 1] / 255;
    input[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) };
  const result = await s.run(feeds);
  const out = result[s.outputNames[0]];
  const anchors = out.dims[2];
  const cands = decodeYolo(
    out.data as Float32Array,
    anchors,
    image.naturalWidth,
    image.naturalHeight,
    minConf,
  );
  return toBoxes(nms(cands));
}
