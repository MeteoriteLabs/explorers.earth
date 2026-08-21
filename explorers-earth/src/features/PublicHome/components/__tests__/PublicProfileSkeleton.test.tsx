import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicProfileSkeleton from "../PublicProfileSkeleton";

describe("PublicProfileSkeleton", () => {
  it("renders public-profile-shell data-testid and skeleton structure", () => {
    render(<PublicProfileSkeleton />);
    const shell = screen.getByTestId("public-profile-shell");
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveAttribute("aria-hidden", "true");
  });
});
