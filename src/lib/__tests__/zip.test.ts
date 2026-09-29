import { describe, expect, it } from 'vitest';
import { cocoJson, yoloLabels } from '../exporters';
import { crc32, makeZip } from '../zip';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes a store-only archive with the right entry count and size', async () => {
    const blob = makeZip([
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'dir/b.txt', data: new TextEncoder().encode('world!') },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // first local header
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50); // end of central directory
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(bytes.length).toBe(30 + 5 + 5 + 30 + 9 + 6 + 46 + 5 + 46 + 9 + 22);
  });
});

describe('label export', () => {
  const img = {
    width: 200,
    height: 100,
    boxes: [{ id: '1', cls: 'inclusion' as const, x: 20, y: 10, w: 40, h: 20 }],
  };
  it('writes normalised YOLO rows: class cx cy w h', () => {
    expect(yoloLabels(img)).toBe('1 0.200000 0.200000 0.200000 0.200000');
  });
  it('writes COCO boxes with 1-based category ids', () => {
    const coco = cocoJson([{ ...img, name: 'a.jpg', blob: new Blob() }]);
    expect(coco.annotations[0]).toMatchObject({ category_id: 2, bbox: [20, 10, 40, 20], area: 800 });
    expect(coco.categories).toHaveLength(6);
  });
});
