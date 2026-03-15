"use client";

import Link from "next/link";

/**
 * Catches unhandled errors in the app tree and shows a fallback UI.
 * Prevents the generic "Application error" screen; offers recovery.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-muted">
          We ran into an issue loading this page. You can try again or go back to
          the dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--panel)]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
