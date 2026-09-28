import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import { StatsHeader } from './components/StatsHeader';
import { Skeleton } from './components/ui';

// One chunk per page: the Live Line never ships the Ant Design table code.
const LiveLine = lazy(() => import('./pages/LiveLine'));
const StationDetail = lazy(() => import('./pages/StationDetail'));
const DefectLog = lazy(() => import('./pages/DefectLog'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false, staleTime: 500 },
  },
});

function Layout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'
    }`;
  return (
    <div className="min-h-dvh">
      <nav className="flex items-center gap-2 border-b border-line px-4 py-2.5 lg:px-6">
        <span className="mr-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-accent/15 text-accent">
            ◎
          </span>
          <span className="hidden sm:inline">Defect Inspection</span>
        </span>
        <NavLink to="/" end className={link}>
          Live line
        </NavLink>
        <NavLink to="/defects" className={link}>
          Defect log
        </NavLink>
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ok" /> Simulated edge API
        </span>
      </nav>
      <StatsHeader />
      <main>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <LiveLine /> },
        { path: 'stations/:id', element: <StationDetail /> },
        { path: 'defects', element: <DefectLog /> },
        { path: '*', element: <LiveLine /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
