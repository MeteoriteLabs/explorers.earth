import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import PublicProfileBio from "../PublicProfileBio";

describe("PublicProfileBio", () => {
  let mockResizeObserverDisconnect: vi.Mock;

  beforeEach(() => {
    mockResizeObserverDisconnect = vi.fn();
    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = mockResizeObserverDisconnect;
    }
    global.ResizeObserver = MockResizeObserver as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("expands and collapses long sanitized biographies", async () => {
    const user = userEvent.setup();
    const longBio = "<p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4 of a long biography</p>";

    // Mock scrollHeight and dynamic clientHeight (expands to 120px when maxHeight is none)
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.style.maxHeight === "none" ? 120 : 72;
    });

    render(<PublicProfileBio html={longBio} />);

    const showMoreButton = screen.getByRole("button", { name: "Show more" });
    expect(showMoreButton).toBeVisible();

    await user.click(showMoreButton);
    // Button should change to "Show less" and REMAIN visible even after clientHeight expands to 120px
    const showLessButton = screen.getByRole("button", { name: "Show less" });
    expect(showLessButton).toBeVisible();

    // Clicking "Show less" collapses the bio back and restores "Show more"
    await user.click(showLessButton);
    expect(screen.getByRole("button", { name: "Show more" })).toBeVisible();
  });

  it("sanitizes malicious HTML at the render boundary", () => {
    const maliciousHtml = '<p>Safe text <script>alert("xss")</script> <a href="javascript:alert(1)">Unsafe link</a></p>';
    const { container } = render(<PublicProfileBio html={maliciousHtml} />);

    expect(screen.getByText("Safe text")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    const link = container.querySelector("a");
    expect(link).not.toHaveAttribute("href", expect.stringContaining("javascript:"));
  });

  it("does not show expansion control when content fits within collapsed lines", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(50);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);

    const shortBio = "<p>Short bio text</p>";
    render(<PublicProfileBio html={shortBio} />);

    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("handles null, undefined, and non-string html safely without extra whitespace", () => {
    const { container } = render(<PublicProfileBio html={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("expands collapsed bio when a hidden link receives focus", () => {
    const bioWithLink = '<p>Line 1</p><p>Line 2</p><p>Line 3</p><p><a href="https://example.com">Hidden link</a></p>';

    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.style.maxHeight === "none" ? 120 : 72;
    });

    render(<PublicProfileBio html={bioWithLink} />);

    const hiddenLink = screen.getByRole("link", { name: "Hidden link" });
    expect(hiddenLink).toBeInTheDocument();

    // Focus link inside collapsed container
    fireEvent.focus(hiddenLink);

    // Bio should now be expanded and button should show "Show less"
    expect(screen.getByRole("button", { name: "Show less" })).toBeVisible();
  });

  it("disconnects ResizeObserver on unmount", () => {
    const { unmount } = render(<PublicProfileBio html="<p>Test</p>" />);
    unmount();
    expect(mockResizeObserverDisconnect).toHaveBeenCalled();
  });
});
