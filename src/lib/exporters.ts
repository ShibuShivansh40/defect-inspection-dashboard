import { DEFECT_CLASSES } from '../types';
import type { Box } from './geometry';
import { makeZip, type ZipEntry } from './zip';

export interface LabelledImage {
  name: string;
  width: number;
  height: number;
  blob: Blob;
  boxes: Box[];
}

const stem = (name: string) => name.replace(/\.[^.]+$/, '');
const fmt = (n: number) => n.toFixed(6);

/** One YOLO label file: `class cx cy w h`, all normalised to 0..1. */
export function yoloLabels(img: Pick<LabelledImage, 'width' | 'height' | 'boxes'>): string {
  return img.boxes
    .map((b) => {
      const cx = (b.x + b.w / 2) / img.width;
      const cy = (b.y + b.h / 2) / img.height;
      return `${DEFECT_CLASSES.indexOf(b.cls)} ${fmt(cx)} ${fmt(cy)} ${fmt(b.w / img.width)} ${fmt(b.h / img.height)}`;
    })
    .join('\n');
}

/** COCO detection JSON for the same boxes. Category ids start at 1. */
export function cocoJson(images: LabelledImage[]) {
  let annId = 1;
  return {
    info: { description: 'Exported from Defect Inspection Labeling Studio' },
    images: images.map((im, i) => ({ id: i + 1, file_name: im.name, width: im.width, height: im.height })),
    categories: DEFECT_CLASSES.map((name, i) => ({ id: i + 1, name })),
    annotations: images.flatMap((im, i) =>
      im.boxes.map((b) => ({
        id: annId++,
        image_id: i + 1,
        category_id: DEFECT_CLASSES.indexOf(b.cls) + 1,
        bbox: [b.x, b.y, b.w, b.h],
        area: b.w * b.h,
        iscrowd: 0,
      })),
    ),
  };
}

/** A YOLO-format dataset zip that `ml/train.py` (or `yolo train`) can consume directly. */
export async function yoloZip(images: LabelledImage[]): Promise<Blob> {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  for (const im of images) {
    entries.push({ name: `images/${im.name}`, data: new Uint8Array(await im.blob.arrayBuffer()) });
    entries.push({ name: `labels/${stem(im.name)}.txt`, data: enc.encode(yoloLabels(im) + '\n') });
  }
  entries.push({
    name: 'data.yaml',
    data: enc.encode(
      `path: .\ntrain: images\nval: images\nnames:\n${DEFECT_CLASSES.map((c, i) => `  ${i}: ${c}`).join('\n')}\n`,
    ),
  });
  entries.push({
    name: 'annotations.coco.json',
    data: enc.encode(JSON.stringify(cocoJson(images), null, 1)),
  });
  return makeZip(entries);
}
