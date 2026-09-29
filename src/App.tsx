import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import metrics from '../ml/metrics.json';
import { StatsHeader } from './components/StatsHeader';
import { Logo } from './components/Logo';
import { ThemeToggle } from './components/ThemeToggle';
import { Skeleton } from './components/ui';

// One chunk per page: the Live Line never ships the Ant Design table code.
const LiveLine = lazy(() => import('./pages/LiveLine'));
const StationDetail = lazy(() => import('./pages/StationDetail'));
const DefectLog = lazy(() => import('./pages/DefectLog'));
const Studio = lazy(() => import('./pages/Studio'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false, staleTime: 500 },
  },
});

function Layout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-ink/10 text-ink' : 'text-muted hover:text-ink'
    }`;
  return (
    <div className="min-h-dvh">
      <nav className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-canvas/80 px-4 py-2.5 backdrop-blur lg:px-6">
        <span className="mr-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Logo />
          <span className="hidden sm:inline">Defect Inspection</span>
        </span>
        <NavLink to="/" end className={link}>
          Live line
        </NavLink>
        <NavLink to="/defects" className={link}>
          Defect log
        </NavLink>
        <NavLink to="/studio" className={link}>
          Studio
        </NavLink>
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ok" />
          <span
            title={`YOLOv8n fine-tuned on NEU-DET. Held-out mAP50 ${metrics.map50}, precision ${metrics.precision}, recall ${metrics.recall} on ${metrics.images} images. Only frames the model never trained on are shown.`}
          >
            Simulated edge API · real YOLOv8n detections
          </span>
        </span>
        <span className="ml-auto sm:ml-2">
          <ThemeToggle />
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
        { path: 'studio', element: <Studio /> },
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
