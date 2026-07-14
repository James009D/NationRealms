import type { ReactNode } from "react";

export function LoadingState({ label = "Loading statecraft data" }: { label?: string }) {
  return (
    <main className="page-shell">
      <div className="status-panel" role="status" aria-live="polite">
        {label}
      </div>
    </main>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <main className="page-shell">
      <div className="status-panel status-panel--error" role="alert">
        <strong>{message}</strong>
        {action ?? (
          <button className="secondary-action" onClick={() => window.location.reload()}>
            Retry
          </button>
        )}
      </div>
    </main>
  );
}
