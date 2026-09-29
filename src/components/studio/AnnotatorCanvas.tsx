import { useEffect, useRef, useState } from 'react';
import { useElementWidth, useImage } from '../../hooks/canvas';
import {
  HANDLES,
  MIN_BOX,
  handlePoint,
  hitBox,
  hitHandle,
  moveBox,
  rectFromPoints,
  resizeBox,
  type Box,
  type Handle,
} from '../../lib/geometry';
import { CLASS_COLORS, CLASS_LABELS } from '../../lib/format';
import { selectCurrent, useStudio } from '../../store/studio';
import { DEFECT_CLASSES } from '../../types';

type Gesture =
  | { kind: 'draw'; x0: number; y0: number; x: number; y: number }
  | { kind: 'move'; id: string; lastX: number; lastY: number; before: Box[] }
  | { kind: 'resize'; id: string; handle: Handle; before: Box[] };

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

/**
 * Interactive Canvas: drag to draw a box, drag a box to move it, drag a handle to resize it.
 * Boxes live in source-image pixels; the pointer is converted with the same scale used for drawing.
 * Keyboard: 1-6 relabel, arrows nudge (Shift = 10 px), Delete removes, Ctrl+Z / Ctrl+Shift+Z undo / redo.
 */
export function AnnotatorCanvas() {
  const image = useStudio(selectCurrent);
  const selectedId = useStudio((s) => s.selectedId);
  const activeClass = useStudio((s) => s.activeClass);
  const store = useStudio;

  const ref = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [tick, setTick] = useState(0); // redraw while a gesture is in progress
  const img = useImage(image?.url);
  const cssW = useElementWidth(ref);
  const ready = image && img && cssW > 0 && img.src === image.url;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image || !ready) return;
    const dpr = window.devicePixelRatio || 1;
    const s = cssW / image.width;
    const cssH = image.height * s;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(img, 0, 0, cssW, cssH);
    ctx.font = '600 11px Inter Variable, ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    for (const b of image.boxes) {
      const color = CLASS_COLORS[b.cls];
      const sel = b.id === selectedId;
      ctx.strokeStyle = color;
      ctx.lineWidth = sel ? 2.5 : 1.75;
      ctx.setLineDash(b.conf !== undefined && !sel ? [5, 3] : []);
      ctx.strokeRect(b.x * s, b.y * s, b.w * s, b.h * s);
      ctx.setLineDash([]);
      ctx.fillStyle = `${color}22`;
      ctx.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
      const label = `${CLASS_LABELS[b.cls]}${b.conf !== undefined ? ` ${Math.round(b.conf * 100)}%` : ''}`;
      const tw = ctx.measureText(label).width + 8;
      const ly = b.y * s < 16 ? b.y * s + 1 : b.y * s - 16;
      ctx.fillStyle = color;
      ctx.fillRect(b.x * s, ly, tw, 15);
      ctx.fillStyle = '#0b0f14';
      ctx.fillText(label, b.x * s + 4, ly + 8);
      if (sel) {
        for (const h of HANDLES) {
          const p = handlePoint(b, h);
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.rect(p.x * s - 4, p.y * s - 4, 8, 8);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    const g = gesture.current;
    if (g?.kind === 'draw') {
      const r = rectFromPoints(g.x0, g.y0, g.x, g.y, image.width, image.height);
      ctx.strokeStyle = CLASS_COLORS[activeClass];
      ctx.lineWidth = 1.75;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
      ctx.setLineDash([]);
    }
  }, [image, img, ready, cssW, selectedId, activeClass, tick]);

  if (!image) return null;

  const toImage = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const s = rect.width / image.width;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s, s };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y, s } = toImage(e);
    const tol = 7 / s;
    const st = store.getState();
    const cur = selectCurrent(st);
    if (!cur) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current?.parentElement?.focus();

    const selected = cur.boxes.find((b) => b.id === st.selectedId);
    const handle = selected ? hitHandle(selected, x, y, tol) : null;
    if (selected && handle) {
      st.snapshot();
      gesture.current = { kind: 'resize', id: selected.id, handle, before: cur.boxes };
      return;
    }
    const hit = [...cur.boxes].reverse().find((b) => hitBox(b, x, y));
    if (hit) {
      st.select(hit.id);
      st.snapshot();
      gesture.current = { kind: 'move', id: hit.id, lastX: x, lastY: y, before: cur.boxes };
      return;
    }
    st.select(null);
    gesture.current = { kind: 'draw', x0: x, y0: y, x, y };
    setTick((t) => t + 1);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, s } = toImage(e);
    const g = gesture.current;
    const st = store.getState();
    const cur = selectCurrent(st);
    if (!cur) return;
    if (!g) {
      const sel = cur.boxes.find((b) => b.id === st.selectedId);
      const h = sel ? hitHandle(sel, x, y, 7 / s) : null;
      e.currentTarget.style.cursor = h
        ? CURSORS[h]
        : cur.boxes.some((b) => hitBox(b, x, y))
          ? 'move'
          : 'crosshair';
      return;
    }
    if (g.kind === 'draw') {
      g.x = x;
      g.y = y;
      setTick((t) => t + 1);
    } else if (g.kind === 'move') {
      const dx = x - g.lastX;
      const dy = y - g.lastY;
      g.lastX = x;
      g.lastY = y;
      st.setBoxes(cur.boxes.map((b) => (b.id === g.id ? moveBox(b, dx, dy, cur.width, cur.height) : b)));
    } else {
      st.setBoxes(
        cur.boxes.map((b) => (b.id === g.id ? resizeBox(b, g.handle, x, y, cur.width, cur.height) : b)),
      );
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    const st = store.getState();
    const cur = selectCurrent(st);
    if (!g || !cur) return;
    if (g.kind === 'draw') {
      const r = rectFromPoints(g.x0, g.y0, g.x, g.y, cur.width, cur.height);
      if (r.w >= MIN_BOX && r.h >= MIN_BOX) {
        st.addBox({ id: crypto.randomUUID(), cls: st.activeClass, ...r });
      }
      setTick((t) => t + 1);
    } else if (cur.boxes === g.before) {
      st.cancelSnapshot(); // a click without a drag changes nothing
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const st = store.getState();
    const cur = selectCurrent(st);
    if (!cur) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) st.redo();
      else st.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      st.redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      st.deleteSelected();
    } else if (e.key === 'Escape') {
      st.select(null);
    } else if (/^[1-6]$/.test(e.key)) {
      const cls = DEFECT_CLASSES[Number(e.key) - 1];
      st.setActiveClass(cls);
      st.relabelSelected(cls);
    } else if (e.key.startsWith('Arrow') && st.selectedId) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      st.snapshot();
      st.setBoxes(
        cur.boxes.map((b) => (b.id === st.selectedId ? moveBox(b, dx, dy, cur.width, cur.height) : b)),
      );
    }
  };

  return (
    <div
      tabIndex={0}
      role="application"
      aria-label={`Annotation canvas for ${image.name}. ${image.boxes.length} boxes. Drag to draw, 1 to 6 to set class, arrow keys to nudge, Delete to remove.`}
      onKeyDown={onKeyDown}
      className="rounded-xl outline-offset-4"
    >
      <canvas
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="block w-full touch-none rounded-xl bg-raised"
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}
