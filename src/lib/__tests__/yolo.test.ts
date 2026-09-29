import { describe, expect, it } from 'vitest';
import { INPUT_SIZE, decodeYolo, nms } from '../yolo';

/** Build a [1, 10, anchors] tensor (4 box rows + 6 class rows) with the given anchors filled in. */
function tensor(
  anchors: number,
  rows: Array<{ i: number; cx: number; cy: number; w: number; h: number; cls: number; s: number }>,
) {
  const out = new Float32Array(10 * anchors);
  for (const r of rows) {
    out[r.i] = r.cx;
    out[anchors + r.i] = r.cy;
    out[2 * anchors + r.i] = r.w;
    out[3 * anchors + r.i] = r.h;
    out[(4 + r.cls) * anchors + r.i] = r.s;
  }
  return out;
}

describe('decodeYolo', () => {
  it('reads channel-major output, picks the best class and scales to the source image', () => {
    const half = INPUT_SIZE / 2;
    const out = tensor(4, [{ i: 1, cx: half, cy: half, w: 56, h: 28, cls: 3, s: 0.8 }]);
    const [d] = decodeYolo(out, 4, 448, 448, 0.25); // source is 2x the model input
    expect(d.cls).toBe(3);
    expect(d.conf).toBeCloseTo(0.8);
    expect(d).toMatchObject({ x: 168, y: 196, w: 112, h: 56 });
  });
  it('drops anchors below the confidence floor', () => {
    const out = tensor(4, [{ i: 0, cx: 50, cy: 50, w: 20, h: 20, cls: 0, s: 0.2 }]);
    expect(decodeYolo(out, 4, 200, 200, 0.25)).toEqual([]);
  });
});

describe('nms', () => {
  const c = (cls: number, conf: number, x: number) => ({ cls, conf, x, y: 0, w: 50, h: 50 });
  it('keeps the strongest of overlapping same-class boxes only', () => {
    const kept = nms([c(0, 0.6, 0), c(0, 0.9, 5), c(0, 0.7, 200)]);
    expect(kept.map((k) => k.conf)).toEqual([0.9, 0.7]);
  });
  it('does not suppress across classes', () => {
    expect(nms([c(0, 0.9, 0), c(1, 0.8, 0)])).toHaveLength(2);
  });
});
