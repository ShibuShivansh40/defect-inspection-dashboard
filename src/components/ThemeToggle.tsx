import { useEffect } from 'react';
import { useUi } from '../store/ui';

/** Switches between the Graphite (dark) and Daylight (light) themes and remembers the choice. */
export function ThemeToggle() {
  const theme = useUi((s) => s.theme);
  const toggle = useUi((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid size-8 place-items-center rounded-md border border-line text-muted hover:bg-ink/5 hover:text-ink"
    >
      {theme === 'dark' ? (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinejoin="round" d="M21 13.2A8.5 8.5 0 1 1 10.8 3a6.8 6.8 0 0 0 10.2 10.2z" />
        </svg>
      )}
    </button>
  );
}
