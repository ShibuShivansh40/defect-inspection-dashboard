import { useEffect, useState, type RefObject } from 'react';

/** Decoded images keyed by URL, so polling and scrubbing never re-download a frame. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        imageCache.delete(url); // allow a retry later
        reject(new Error(`failed to load ${url}`));
      };
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

/** Returns the loaded image for `url`, or the previous one while the next is loading. */
export function useImage(url: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadImage(url).then(
      (loaded) => alive && setImg(loaded),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

/** CSS width of an element, tracked with ResizeObserver. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
