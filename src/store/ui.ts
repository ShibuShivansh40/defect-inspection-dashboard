import { create } from 'zustand';
import type { DefectFilters } from '../types';

/** Client-only UI state. Server data never lives here; it lives in React Query. */
interface UiState {
  threshold: number;
  setThreshold: (threshold: number) => void;
  filters: DefectFilters;
  /** Any filter change resets to page 1 unless the patch sets a page. */
  setFilters: (patch: Partial<DefectFilters>) => void;
  resetFilters: () => void;
}

export const MIN_THRESHOLD = 0.5;

const initialFilters: DefectFilters = {
  cls: [],
  stationId: null,
  from: null,
  to: null,
  page: 1,
  pageSize: 20,
};

export const useUi = create<UiState>()((set) => ({
  threshold: MIN_THRESHOLD,
  setThreshold: (threshold) => set({ threshold }),
  filters: initialFilters,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, page: 1, ...patch } })),
  resetFilters: () => set({ filters: initialFilters }),
}));
