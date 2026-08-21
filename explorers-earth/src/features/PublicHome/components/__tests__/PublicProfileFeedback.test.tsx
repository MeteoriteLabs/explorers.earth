import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicProfileFeedback from "../PublicProfileFeedback";

describe("PublicProfileFeedback", () => {
  it("renders empty feedback state", () => {
    render(
      <PublicProfileFeedback
        kind="empty"
        title="Profile Not Found"
        description="This profile does not exist."
      />
    );
    expect(screen.getByText("Profile Not Found")).toBeInTheDocument();
    expect(screen.getByText("This profile does not exist.")).toBeInTheDocument();
  });

  it("renders partial-error feedback state and triggers onRetry", () => {
    const onRetry = vi.fn();
    render(
      <PublicProfileFeedback
        kind="partial-error"
        title="Couldn't verify this profile"
        retrying={false}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText("Couldn't verify this profile")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toHaveClass("min-h-[44px]");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders all-error feedback state with disabled button when retrying", () => {
    const onRetry = vi.fn();
    render(
      <PublicProfileFeedback
        kind="all-error"
        title="Couldn't load this profile"
        description="Network failed"
        retrying={true}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText("Couldn't load this profile")).toBeInTheDocument();
    expect(screen.getByText("Network failed")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Retrying..." });
    expect(retryBtn).toBeDisabled();
  });
});
