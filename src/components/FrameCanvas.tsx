import { useEffect, useRef } from 'react';
import { useElementWidth, useImage } from '../hooks/canvas';
import { CLASS_COLORS, CLASS_LABELS } from '../lib/format';
import { useUi } from '../store/ui';
import type { Frame } from '../types';

interface Props {
  frame: Frame;
  /** Detection to emphasise; the others are drawn faintly. */
  highlightId?: string;
  /** Ignore the global confidence threshold (e.g. when inspecting a logged defect). */
  showAll?: boolean;
  className?: string;
}

const LABEL_H = 16;

/**
 * Draws a frame and its detection boxes on a <canvas>.
 * Boxes are stored in source-image pixels, scaled to the canvas's CSS width and
 * multiplied by devicePixelRatio so lines stay sharp on high-DPI screens.
 * Redraws only when the frame, threshold, highlight or size changes.
 */
export function FrameCanvas({ frame, highlightId, showAll = false, className = '' }: Props) {
  const threshold = useUi((s) => s.threshold);
  const ref = useRef<HTMLCanvasElement>(null);
  const img = useImage(frame.imageUrl);
  const cssW = useElementWidth(ref);

  useEffect(() => {
    const canvas = ref.current;
    // Wait for this frame's own image, so boxes never land on the previous picture.
    if (!canvas || !img || !cssW || !img.src.endsWith(frame.imageUrl)) return;
    const dpr = window.devicePixelRatio || 1;
    const cssH = cssW * (frame.height / frame.width);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, cssW, cssH);

    const s = cssW / frame.width;
    const fontPx = cssW < 260 ? 10 : 12;
    ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';

    for (const d of frame.detections) {
      if (!showAll && d.confidence < threshold) continue;
      const dim = highlightId !== undefined && d.id !== highlightId;
      const x = d.box.x * s;
      const y = d.box.y * s;
      const w = d.box.w * s;
      const h = d.box.h * s;
      const color = CLASS_COLORS[d.cls];

      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = highlightId === d.id ? 3 : 2;
      ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

      const label = `${CLASS_LABELS[d.cls]} ${Math.round(d.confidence * 100)}%`;
      const tw = Math.min(ctx.measureText(label).width + 8, cssW - x);
      // Label above the box, or inside it when the box touches the top edge.
      const ly = y < LABEL_H ? y + 1 : y - LABEL_H;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, ly, tw, LABEL_H);
      ctx.fillStyle = '#0b0f14';
      ctx.fillText(label, x + 5, ly + LABEL_H / 2 + 0.5, tw - 8);
    }
    ctx.globalAlpha = 1;
  }, [img, frame, threshold, cssW, highlightId, showAll]);

  const visible = frame.detections.filter((d) => showAll || d.confidence >= threshold).length;
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Frame ${frame.id}: ${visible} defect${visible === 1 ? '' : 's'} shown`}
      className={`block aspect-square w-full bg-slate-800 ${className}`}
    />
  );
}
