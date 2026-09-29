import { DEFECT_CLASSES } from '../types';
import { iou, type Box } from './geometry';

/** Model input side. The frames are 200×200; 224 is the nearest multiple of the model stride. */
export const INPUT_SIZE = 224;

interface Candidate {
  cls: number;
  conf: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Decode a YOLOv8 detection head.
 * `output` is the flattened [1, 4 + classes, anchors] tensor: rows 0..3 are cx, cy, w, h in input pixels,
 * the remaining rows are per-class scores. Boxes are scaled back to the source image.
 */
export function decodeYolo(
  output: Float32Array,
  anchors: number,
  imgW: number,
  imgH: number,
  minConf: number,
): Candidate[] {
  const classes = DEFECT_CLASSES.length;
  const sx = imgW / INPUT_SIZE;
  const sy = imgH / INPUT_SIZE;
  const out: Candidate[] = [];
  for (let i = 0; i < anchors; i++) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < classes; c++) {
      const s = output[(4 + c) * anchors + i];
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best < 0 || bestScore < minConf) continue;
    const cx = output[i];
    const cy = output[anchors + i];
    const w = output[2 * anchors + i];
    const h = output[3 * anchors + i];
    const x1 = Math.max(0, (cx - w / 2) * sx);
    const y1 = Math.max(0, (cy - h / 2) * sy);
    const x2 = Math.min(imgW, (cx + w / 2) * sx);
    const y2 = Math.min(imgH, (cy + h / 2) * sy);
    if (x2 - x1 < 1 || y2 - y1 < 1) continue;
    out.push({ cls: best, conf: bestScore, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  }
  return out;
}

/** Greedy non-maximum suppression, per class. */
export function nms(cands: Candidate[], iouThreshold = 0.45): Candidate[] {
  const sorted = [...cands].sort((a, b) => b.conf - a.conf);
  const keep: Candidate[] = [];
  for (const c of sorted) {
    if (keep.every((k) => k.cls !== c.cls || iou(k, c) < iouThreshold)) keep.push(c);
  }
  return keep;
}

export function toBoxes(cands: Candidate[]): Box[] {
  return cands.map((c) => ({
    id: crypto.randomUUID(),
    cls: DEFECT_CLASSES[c.cls],
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    conf: c.conf,
  }));
}
