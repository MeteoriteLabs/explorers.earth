import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountDeletionLifecyclePanel from "./AccountDeletionLifecyclePanel";

describe("AccountDeletionLifecyclePanel", () => {
  it("offers cancellation only before the irreversible boundary", () => {
    // Break caught: reload gives no recovery action or permits a late cancellation.
    const onCancel = vi.fn();
    const { rerender } = render(<AccountDeletionLifecyclePanel status={{
      status: "pending_deletion", phase: "prepared", state: "completed",
      boundaryCrossed: false, retryable: false, deadLetter: false,
    }} onCancel={onCancel} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel deletion/i }));
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(<AccountDeletionLifecyclePanel status={{
      status: "pending_deletion", phase: "prepared", state: "requested",
      boundaryCrossed: true, retryable: true, deadLetter: false,
    }} onCancel={onCancel} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /cancel deletion/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry account deletion/i })).toBeInTheDocument();
  });

  it("shows typed escalation only for a durable dead letter", () => {
    // Break caught: exhausted cleanup retries look like a healthy background operation.
    render(<AccountDeletionLifecyclePanel status={{
      status: "pending_deletion", phase: "prepared", state: "failed",
      boundaryCrossed: true, retryable: false, deadLetter: true,
    }} onCancel={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/contact support/i);
    expect(screen.queryByRole("button", { name: /retry account deletion/i })).not.toBeInTheDocument();
  });
});
