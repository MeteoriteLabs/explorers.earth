import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PublicPlaceCard from "../PublicPlaceCard";

// PublicPlaceCard does not itself use react-i18next, but mock defensively in
// case shared imports pull it in.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const base = {
  title: "Lalbagh",
  image: "",
  onClickhandler: () => {},
};

const renderCard = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <PublicPlaceCard {...base} {...props} />
    </MemoryRouter>
  );

describe("PublicPlaceCard rating", () => {
  it("does not crash and hides rating when rating is an empty string", () => {
    expect(() => renderCard({ rating: "" as unknown as number })).not.toThrow();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it("renders a numeric string rating without throwing", () => {
    expect(() =>
      renderCard({ rating: "8.8" as unknown as number })
    ).not.toThrow();
    expect(screen.getByText(/8\.8/)).toBeTruthy();
  });

  it("renders a numeric rating", () => {
    renderCard({ rating: 8.8 });
    expect(screen.getByText(/8\.8/)).toBeTruthy();
  });

  it("renders a zero rating as 0.0", () => {
    renderCard({ rating: 0 });
    expect(screen.getByText(/0\.0/)).toBeTruthy();
  });

  it("hides rating when undefined", () => {
    renderCard({ rating: undefined });
    expect(screen.queryByText(/★/)).toBeNull();
  });
});
