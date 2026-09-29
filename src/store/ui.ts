import { create } from 'zustand';
import type { DefectFilters } from '../types';

/** Client-only UI state. Server data never lives here; it lives in React Query. */
export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  toggleTheme: () => void;
  threshold: number;
  setThreshold: (threshold: number) => void;
  filters: DefectFilters;
  /** Any filter change resets to page 1 unless the patch sets a page. */
  setFilters: (patch: Partial<DefectFilters>) => void;
  resetFilters: () => void;
}

/** Lowest threshold the slider offers; predictions below it are not stored. */
export const MIN_THRESHOLD = 0.25;
export const DEFAULT_THRESHOLD = 0.5;

const initialFilters: DefectFilters = {
  cls: [],
  stationId: null,
  from: null,
  to: null,
  page: 1,
  pageSize: 20,
};

/** index.html sets data-theme before first paint (saved choice, else the OS setting). */
const initialTheme = (): Theme =>
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

export const useUi = create<UiState>()((set) => ({
  theme: initialTheme(),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  threshold: DEFAULT_THRESHOLD,
  setThreshold: (threshold) => set({ threshold }),
  filters: initialFilters,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, page: 1, ...patch } })),
  resetFilters: () => set({ filters: initialFilters }),
}));
