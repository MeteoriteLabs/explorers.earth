import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PublicHeaderShareIcon } from "../PublicBranding";
import { PublicHeaderDescriptorProvider } from "../PublicHeaderDescriptorContext";
import { PublicProfileFixedHeader } from "../PublicProfileChromePrimitives";

describe("public header share icon", () => {
  it("uses one consistent 20px Share2 glyph", () => {
    const { container } = render(<PublicHeaderShareIcon />);
    const icon = container.querySelector("[data-public-header-share-icon]");

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("width", "20");
    expect(icon).toHaveAttribute("height", "20");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the icon-only profile header action at a 44px touch target", () => {
    render(
      <MemoryRouter>
        <PublicHeaderDescriptorProvider origin="https://explorers.earth" username="alice" profileName="Alice">
          <PublicProfileFixedHeader onTrackClick={vi.fn()} />
        </PublicHeaderDescriptorProvider>
      </MemoryRouter>,
    );

    const share = screen.getByRole("button", { name: "Share" });
    expect(share).toHaveClass("min-h-11", "min-w-11");
    expect(share).toHaveTextContent("");
    expect(share.querySelector("[data-public-header-share-icon]")).toHaveAttribute("aria-hidden", "true");
  });
});
