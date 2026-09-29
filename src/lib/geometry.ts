import type { DefectClass } from '../types';

/** A labelled box in source-image pixels. `conf` is set for boxes proposed by the model. */
export interface Box {
  id: string;
  cls: DefectClass;
  x: number;
  y: number;
  w: number;
  h: number;
  conf?: number;
}

export type Rect = Pick<Box, 'x' | 'y' | 'w' | 'h'>;
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const MIN_BOX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Normalised rectangle between two drag points, clamped to the image. */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number, W: number, H: number): Rect {
  const x1 = clamp(Math.min(ax, bx), 0, W);
  const y1 = clamp(Math.min(ay, by), 0, H);
  const x2 = clamp(Math.max(ax, bx), 0, W);
  const y2 = clamp(Math.max(ay, by), 0, H);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function handlePoint(b: Rect, handle: Handle): { x: number; y: number } {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  const x = handle.includes('w') ? b.x : handle.includes('e') ? right : cx;
  const y = handle.includes('n') ? b.y : handle.includes('s') ? bottom : cy;
  return { x, y };
}

/** Which resize handle (if any) is within `tol` image pixels of the point. */
export function hitHandle(b: Rect, px: number, py: number, tol: number): Handle | null {
  for (const h of HANDLES) {
    const p = handlePoint(b, h);
    if (Math.abs(p.x - px) <= tol && Math.abs(p.y - py) <= tol) return h;
  }
  return null;
}

export const hitBox = (b: Rect, px: number, py: number) =>
  px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;

/** Drag one handle to the pointer; the opposite edges stay put and the box keeps a minimum size. */
export function resizeBox<T extends Rect>(
  b: T,
  handle: Handle,
  px: number,
  py: number,
  W: number,
  H: number,
): T {
  let left = b.x;
  let top = b.y;
  let right = b.x + b.w;
  let bottom = b.y + b.h;
  if (handle.includes('w')) left = clamp(px, 0, right - MIN_BOX);
  if (handle.includes('e')) right = clamp(px, left + MIN_BOX, W);
  if (handle.includes('n')) top = clamp(py, 0, bottom - MIN_BOX);
  if (handle.includes('s')) bottom = clamp(py, top + MIN_BOX, H);
  return { ...b, x: left, y: top, w: right - left, h: bottom - top };
}

/** Translate a box, keeping it fully inside the image. */
export function moveBox<T extends Rect>(b: T, dx: number, dy: number, W: number, H: number): T {
  return { ...b, x: clamp(b.x + dx, 0, W - b.w), y: clamp(b.y + dy, 0, H - b.h) };
}

export function iou(a: Rect, b: Rect): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

export const round = (b: Box): Box => ({
  ...b,
  x: Math.round(b.x),
  y: Math.round(b.y),
  w: Math.round(b.w),
  h: Math.round(b.h),
});
