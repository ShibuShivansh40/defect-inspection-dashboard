import type { DefectClass } from '../types';

/** Box colours, picked to stay distinct on grey steel frames and a dark UI. */
export const CLASS_COLORS: Record<DefectClass, string> = {
  crazing: '#fb923c',
  inclusion: '#22d3ee',
  patches: '#a3e635',
  pitted_surface: '#f472b6',
  rolled_in_scale: '#facc15',
  scratches: '#a78bfa',
};

export const CLASS_LABELS: Record<DefectClass, string> = {
  crazing: 'Crazing',
  inclusion: 'Inclusion',
  patches: 'Patches',
  pitted_surface: 'Pitted surface',
  rolled_in_scale: 'Rolled-in scale',
  scratches: 'Scratches',
};

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const num = (v: number) => v.toLocaleString();
