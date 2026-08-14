import type { AccountLifecycleStatus } from "../../../services/accountLifecycleService";

type Status = AccountLifecycleStatus["operation"];

export default function AccountDeletionLifecyclePanel({
  status,
  onCancel,
  onRetry,
}: {
  status: Omit<Status, "operationId"> & { operationId?: string };
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (status.deadLetter) {
    return (
      <div role="alert" className="dt-subtext text-dashboard-danger mt-4">
        Account deletion needs manual review. Contact support and include the request ID shown with the error.
      </div>
    );
  }
  if (status.boundaryCrossed) {
    return (
      <div role="status" aria-live="polite" className="mt-4">
        <p className="dt-subtext text-white-muted">Account deletion is in progress. You can safely close this tab.</p>
        {status.retryable && (
          <button type="button" className="dt-button mt-3" onClick={onRetry}>Retry account deletion</button>
        )}
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className="mt-4">
      <p className="dt-subtext text-white-muted">Account deletion is prepared. Music access is paused.</p>
      <button type="button" className="dt-button mt-3" onClick={onCancel}>Cancel deletion</button>
    </div>
  );
}
