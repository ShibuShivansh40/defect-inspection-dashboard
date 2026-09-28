import { ConfigProvider, Table, theme, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { FrameDialog } from '../components/FrameDialog';
import { ErrorState } from '../components/ui';
import { useDefects, useStations } from '../hooks/queries';
import { CLASS_COLORS, CLASS_LABELS, pct, timeOf } from '../lib/format';
import { useUi } from '../store/ui';
import { DEFECT_CLASSES, type DefectRow } from '../types';

const RANGES = [
  { label: 'Whole shift', minutes: null },
  { label: 'Last 5 min', minutes: 5 },
  { label: 'Last 15 min', minutes: 15 },
  { label: 'Last hour', minutes: 60 },
] as const;

const columns: TableColumnsType<DefectRow> = [
  {
    title: 'Time',
    dataIndex: 'capturedAt',
    width: 110,
    render: (v: string) => <span className="tabular-nums">{timeOf(v)}</span>,
  },
  {
    title: 'Station',
    dataIndex: 'stationId',
    width: 90,
    render: (v: string) => v.replace('st-', 'S'),
  },
  {
    title: 'Class',
    dataIndex: 'cls',
    render: (v: DefectRow['cls']) => (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CLASS_COLORS[v] }} />
        {CLASS_LABELS[v]}
      </span>
    ),
  },
  {
    title: 'Confidence',
    dataIndex: 'confidence',
    width: 110,
    align: 'right',
    render: (v: number) => <span className="tabular-nums">{pct(v, 0)}</span>,
  },
  {
    title: 'Size',
    key: 'size',
    width: 100,
    responsive: ['md'],
    render: (_, r) => (
      <span className="tabular-nums">
        {r.box.w}×{r.box.h}
      </span>
    ),
  },
  { title: 'Frame', dataIndex: 'frameId', responsive: ['lg'], className: 'text-xs' },
];

export default function DefectLog() {
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const resetFilters = useUi((s) => s.resetFilters);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [selected, setSelected] = useState<DefectRow | null>(null);

  const stations = useStations();
  const defects = useDefects(filters);
  const loading = defects.isPending || (defects.isFetching && defects.isPlaceholderData);

  const toggleClass = (c: DefectRow['cls']) =>
    setFilters({ cls: filters.cls.includes(c) ? filters.cls.filter((x) => x !== c) : [...filters.cls, c] });

  const setRange = (i: number) => {
    setRangeIdx(i);
    const m = RANGES[i].minutes;
    setFilters({ from: m === null ? null : new Date(Date.now() - m * 60_000).toISOString(), to: null });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Defect log</h1>
          <p className="text-sm text-muted">
            Every detection this shift, newest first. Click a row to see the frame.
          </p>
        </div>
        <button
          type="button"
          onClick={() => defects.refetch()}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-white/5"
        >
          {defects.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-line bg-panel p-3">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Defect classes</legend>
          <span className="mr-1 text-xs font-medium text-muted">Class</span>
          {DEFECT_CLASSES.map((c) => {
            const on = filters.cls.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleClass(c)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on ? 'border-transparent bg-white/10 text-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                <span aria-hidden className="size-2 rounded-sm" style={{ background: CLASS_COLORS[c] }} />
                {CLASS_LABELS[c]}
              </button>
            );
          })}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            Station
            <select
              value={filters.stationId ?? ''}
              onChange={(e) => setFilters({ stationId: e.target.value || null })}
              className="rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink"
            >
              <option value="">All stations</option>
              {stations.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Time
            <select
              value={rangeIdx}
              onChange={(e) => setRange(Number(e.target.value))}
              className="rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink"
            >
              {RANGES.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {(filters.cls.length > 0 || filters.stationId || rangeIdx !== 0) && (
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setRangeIdx(0);
              }}
              className="text-xs text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted">
            {defects.data ? `${defects.data.total.toLocaleString()} defects` : ''}
          </span>
        </div>
      </div>

      {defects.isError && !defects.data ? (
        <ErrorState
          title="Couldn't load defects"
          message={defects.error.message}
          onRetry={() => defects.refetch()}
          retrying={defects.isFetching}
        />
      ) : (
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: { colorBgContainer: '#111821', colorBorderSecondary: '#1f2a37', colorPrimary: '#38bdf8' },
          }}
        >
          <Table<DefectRow>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={defects.data?.items}
            loading={loading}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'No defects match these filters.' }}
            onRow={(r) => ({
              onClick: () => setSelected(r),
              onKeyDown: (e) => e.key === 'Enter' && setSelected(r),
              tabIndex: 0,
              className: 'cursor-pointer',
            })}
            pagination={{
              current: filters.page,
              pageSize: filters.pageSize,
              total: defects.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onChange: (page, pageSize) =>
                setFilters(pageSize !== filters.pageSize ? { page: 1, pageSize } : { page }),
            }}
          />
        </ConfigProvider>
      )}

      <FrameDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
