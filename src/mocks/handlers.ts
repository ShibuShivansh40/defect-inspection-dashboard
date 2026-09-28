import { delay, http, HttpResponse } from 'msw';
import { DEFECT_CLASSES, type DefectClass } from '../types';
import {
  frameAt,
  getStations,
  getStats,
  isKnownStation,
  latestFrame,
  nowTick,
  parseFrameId,
  queryDefects,
  recentFrames,
  stationStatus,
} from './engine';

const BASE = import.meta.env.BASE_URL;
const ERROR_RATE = 0.02;

/** Every request: 50–300 ms latency, and ~2% fail with a 503 to exercise retries. */
async function network() {
  await delay(50 + Math.random() * 250);
  if (Math.random() < ERROR_RATE) {
    return HttpResponse.json({ error: 'upstream edge device timeout' }, { status: 503 });
  }
  return null;
}

const notFound = (what: string) => HttpResponse.json({ error: `${what} not found` }, { status: 404 });

export const handlers = [
  http.get('*/api/stations', async () => {
    const fail = await network();
    if (fail) return fail;
    return HttpResponse.json(getStations(nowTick()));
  }),

  http.get('*/api/stations/:id/latest', async ({ params }) => {
    const fail = await network();
    if (fail) return fail;
    const id = String(params.id);
    if (!isKnownStation(id)) return notFound('station');
    const tick = nowTick();
    if (stationStatus(id, tick) === 'offline') {
      return HttpResponse.json({ error: 'camera offline' }, { status: 503 });
    }
    return HttpResponse.json(latestFrame(id, tick, BASE));
  }),

  http.get('*/api/stations/:id/frames', async ({ params, request }) => {
    const fail = await network();
    if (fail) return fail;
    const id = String(params.id);
    if (!isKnownStation(id)) return notFound('station');
    const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get('limit') ?? 50)));
    return HttpResponse.json(recentFrames(id, nowTick(), limit, BASE));
  }),

  http.get('*/api/frames/:id', async ({ params }) => {
    const fail = await network();
    if (fail) return fail;
    const parsed = parseFrameId(String(params.id));
    const frame = parsed && parsed.tick <= nowTick() ? frameAt(parsed.stationId, parsed.tick, BASE) : null;
    return frame ? HttpResponse.json(frame) : notFound('frame');
  }),

  http.get('*/api/defects', async ({ request }) => {
    const fail = await network();
    if (fail) return fail;
    const sp = new URL(request.url).searchParams;
    const cls = sp
      .getAll('cls')
      .filter((c): c is DefectClass => (DEFECT_CLASSES as readonly string[]).includes(c));
    const from = sp.get('from');
    const to = sp.get('to');
    const page = Math.max(1, Number(sp.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? 20)));
    return HttpResponse.json(
      queryDefects(
        nowTick(),
        {
          cls,
          stationId: sp.get('station') || null,
          from: from ? Date.parse(from) : null,
          to: to ? Date.parse(to) : null,
          page,
          pageSize,
        },
        BASE,
      ),
    );
  }),

  http.get('*/api/stats', async () => {
    const fail = await network();
    if (fail) return fail;
    return HttpResponse.json(getStats(nowTick(), BASE));
  }),
];
