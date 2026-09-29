import { create } from 'zustand';
import type { Box } from '../lib/geometry';
import { DEFECT_CLASSES, type DefectClass } from '../types';

/** Client-only state for the Labeling Studio: images, their boxes and the undo history. */
export interface StudioImage {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  width: number;
  height: number;
  source: 'upload' | 'camera' | 'sample';
  boxes: Box[];
  undo: Box[][];
  redo: Box[][];
}

export interface NewImage {
  name: string;
  blob: Blob;
  width: number;
  height: number;
  source: StudioImage['source'];
}

interface StudioState {
  images: StudioImage[];
  currentId: string | null;
  selectedId: string | null;
  activeClass: DefectClass;
  addImages: (items: NewImage[]) => void;
  removeImage: (id: string) => void;
  setCurrent: (id: string) => void;
  step: (delta: 1 | -1) => void;
  setActiveClass: (cls: DefectClass) => void;
  select: (boxId: string | null) => void;
  /** Push the current boxes onto the undo stack. Call once before a change. */
  snapshot: () => void;
  /** Replace boxes without touching history (used while dragging). */
  setBoxes: (boxes: Box[]) => void;
  /** Drop the snapshot again if the gesture changed nothing. */
  cancelSnapshot: () => void;
  addBox: (box: Box) => void;
  deleteSelected: () => void;
  relabelSelected: (cls: DefectClass) => void;
  replaceBoxes: (boxes: Box[]) => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 100;

function patchCurrent(s: StudioState, fn: (img: StudioImage) => StudioImage): Partial<StudioState> {
  return { images: s.images.map((im) => (im.id === s.currentId ? fn(im) : im)) };
}

export const useStudio = create<StudioState>()((set, get) => ({
  images: [],
  currentId: null,
  selectedId: null,
  activeClass: DEFECT_CLASSES[0],

  addImages: (items) =>
    set((s) => {
      const added: StudioImage[] = items.map((it) => ({
        ...it,
        id: crypto.randomUUID(),
        url: URL.createObjectURL(it.blob),
        boxes: [],
        undo: [],
        redo: [],
      }));
      return {
        images: [...s.images, ...added],
        currentId: s.currentId ?? added[0]?.id ?? null,
      };
    }),

  removeImage: (id) =>
    set((s) => {
      const doomed = s.images.find((im) => im.id === id);
      if (doomed) URL.revokeObjectURL(doomed.url);
      const images = s.images.filter((im) => im.id !== id);
      const currentId = s.currentId === id ? (images[0]?.id ?? null) : s.currentId;
      return { images, currentId, selectedId: null };
    }),

  setCurrent: (id) => set({ currentId: id, selectedId: null }),

  step: (delta) =>
    set((s) => {
      if (s.images.length === 0) return {};
      const i = s.images.findIndex((im) => im.id === s.currentId);
      const next = s.images[(i + delta + s.images.length) % s.images.length];
      return { currentId: next.id, selectedId: null };
    }),

  setActiveClass: (cls) => set({ activeClass: cls }),
  select: (boxId) => set({ selectedId: boxId }),

  snapshot: () =>
    set((s) =>
      patchCurrent(s, (im) => ({ ...im, undo: [...im.undo, im.boxes].slice(-MAX_HISTORY), redo: [] })),
    ),
  setBoxes: (boxes) => set((s) => patchCurrent(s, (im) => ({ ...im, boxes }))),
  cancelSnapshot: () => set((s) => patchCurrent(s, (im) => ({ ...im, undo: im.undo.slice(0, -1) }))),

  addBox: (box) => {
    get().snapshot();
    set((s) => ({ ...patchCurrent(s, (im) => ({ ...im, boxes: [...im.boxes, box] })), selectedId: box.id }));
  },

  deleteSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;
    get().snapshot();
    set((s) => ({
      ...patchCurrent(s, (im) => ({ ...im, boxes: im.boxes.filter((b) => b.id !== selectedId) })),
      selectedId: null,
    }));
  },

  relabelSelected: (cls) => {
    const { selectedId } = get();
    if (!selectedId) return;
    get().snapshot();
    set((s) =>
      patchCurrent(s, (im) => ({
        ...im,
        boxes: im.boxes.map((b) => (b.id === selectedId ? { ...b, cls } : b)),
      })),
    );
  },

  replaceBoxes: (boxes) => {
    get().snapshot();
    set((s) => ({ ...patchCurrent(s, (im) => ({ ...im, boxes })), selectedId: null }));
  },

  undo: () =>
    set((s) => ({
      ...patchCurrent(s, (im) => {
        const prev = im.undo.at(-1);
        return prev ? { ...im, boxes: prev, undo: im.undo.slice(0, -1), redo: [...im.redo, im.boxes] } : im;
      }),
      selectedId: null,
    })),
  redo: () =>
    set((s) => ({
      ...patchCurrent(s, (im) => {
        const next = im.redo.at(-1);
        return next ? { ...im, boxes: next, redo: im.redo.slice(0, -1), undo: [...im.undo, im.boxes] } : im;
      }),
      selectedId: null,
    })),
}));

export const selectCurrent = (s: StudioState) => s.images.find((im) => im.id === s.currentId);
