import { describe, expect, it } from 'vitest';
import { hitBox, hitHandle, iou, moveBox, rectFromPoints, resizeBox, MIN_BOX } from '../geometry';

const box = { id: 'b', cls: 'crazing' as const, x: 20, y: 30, w: 40, h: 50 };

describe('rectFromPoints', () => {
  it('normalises drag direction and clamps to the image', () => {
    expect(rectFromPoints(60, 80, 20, 30, 200, 200)).toEqual({ x: 20, y: 30, w: 40, h: 50 });
    expect(rectFromPoints(-10, -10, 250, 250, 200, 200)).toEqual({ x: 0, y: 0, w: 200, h: 200 });
  });
});

describe('hit testing', () => {
  it('finds handles within tolerance and boxes by containment', () => {
    expect(hitHandle(box, 21, 31, 3)).toBe('nw');
    expect(hitHandle(box, 60, 55, 3)).toBe('e');
    expect(hitHandle(box, 40, 55, 3)).toBeNull();
    expect(hitBox(box, 40, 55)).toBe(true);
    expect(hitBox(box, 0, 0)).toBe(false);
  });
});

describe('resizeBox', () => {
  it('moves only the dragged edges and keeps the opposite ones fixed', () => {
    const r = resizeBox(box, 'se', 100, 120, 200, 200);
    expect(r).toMatchObject({ x: 20, y: 30, w: 80, h: 90 });
  });
  it('never shrinks below the minimum size or leaves the image', () => {
    const r = resizeBox(box, 'nw', 500, 500, 200, 200);
    expect(r.w).toBe(MIN_BOX);
    expect(r.h).toBe(MIN_BOX);
    expect(resizeBox(box, 'se', 999, 999, 200, 200)).toMatchObject({ w: 180, h: 170 });
  });
});

describe('moveBox', () => {
  it('keeps the box fully inside the image', () => {
    expect(moveBox(box, 500, 500, 200, 200)).toMatchObject({ x: 160, y: 150 });
    expect(moveBox(box, -500, -500, 200, 200)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('iou', () => {
  it('is 1 for identical boxes, 0 for disjoint ones and 1/3 for half overlap', () => {
    expect(iou(box, box)).toBe(1);
    expect(iou(box, { x: 100, y: 100, w: 10, h: 10 })).toBe(0);
    expect(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(1 / 3);
  });
});
