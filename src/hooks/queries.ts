import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DefectFilters, DefectPage, Frame, Station, Stats } from '../types';

export const queryKeys = {
  stations: ['stations'] as const,
  latest: (stationId: string) => ['stations', stationId, 'latest'] as const,
  frames: (stationId: string, limit: number) => ['stations', stationId, 'frames', limit] as const,
  frame: (frameId: string) => ['frames', frameId] as const,
  defects: (filters: DefectFilters) => ['defects', filters] as const,
  stats: ['stats'] as const,
};

export const useStations = () =>
  useQuery({
    queryKey: queryKeys.stations,
    queryFn: ({ signal }) => api.get<Station[]>('/api/stations', signal),
    refetchInterval: 2000,
  });

/**
 * One query per station, so a slow or offline camera never blocks the others.
 * Polls every second; backs off to 5 s while the station is erroring.
 */
export const useLatestFrame = (stationId: string) =>
  useQuery({
    queryKey: queryKeys.latest(stationId),
    queryFn: ({ signal }) => api.get<Frame>(`/api/stations/${stationId}/latest`, signal),
    refetchInterval: (query) => (query.state.status === 'error' ? 5000 : 1000),
    refetchIntervalInBackground: false, // stop polling in a hidden tab
    retry: 1,
    retryDelay: 500,
    placeholderData: keepPreviousData, // keep the last frame on screen while the next loads
  });

export const useFrames = (stationId: string, limit: number, live: boolean) =>
  useQuery({
    queryKey: queryKeys.frames(stationId, limit),
    queryFn: ({ signal }) => api.get<Frame[]>(`/api/stations/${stationId}/frames?limit=${limit}`, signal),
    refetchInterval: live ? 1000 : false, // freeze history while the user scrubs
    placeholderData: keepPreviousData,
  });

export const useFrame = (frameId: string | null) =>
  useQuery({
    queryKey: queryKeys.frame(frameId ?? ''),
    queryFn: ({ signal }) => api.get<Frame>(`/api/frames/${frameId}`, signal),
    enabled: frameId !== null,
    staleTime: Infinity, // a captured frame never changes
  });

export function toSearchParams(f: DefectFilters): string {
  const sp = new URLSearchParams();
  f.cls.forEach((c) => sp.append('cls', c));
  if (f.stationId) sp.set('station', f.stationId);
  if (f.from) sp.set('from', f.from);
  if (f.to) sp.set('to', f.to);
  sp.set('page', String(f.page));
  sp.set('pageSize', String(f.pageSize));
  return sp.toString();
}

export const useDefects = (filters: DefectFilters) =>
  useQuery({
    queryKey: queryKeys.defects(filters), // filters in the key = refetch + cache per filter set
    queryFn: ({ signal }) => api.get<DefectPage>(`/api/defects?${toSearchParams(filters)}`, signal),
    placeholderData: keepPreviousData, // table doesn't flash empty between pages
  });

export const useStats = () =>
  useQuery({
    queryKey: queryKeys.stats,
    queryFn: ({ signal }) => api.get<Stats & { shiftStartedAt: string }>('/api/stats', signal),
    refetchInterval: 2000,
  });
