import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  publicRouteContract,
  type PublicRouteId,
  type PublicRouteSkeleton as SkeletonKind,
} from "../../routes/publicRouteContract";
import { PublicRouteSkeleton } from "../PublicRouteSkeleton";

const kinds: SkeletonKind[] = ["profile-root", "collection", "detail", "map"];
const expectedRouteGeometry: Record<PublicRouteId, { shell: SkeletonKind; skeleton: SkeletonKind }> = {
  profile: { shell: "profile-root", skeleton: "profile-root" },
  music: { shell: "collection", skeleton: "collection" },
  "places-index": { shell: "collection", skeleton: "collection" },
  "places-detail": { shell: "detail", skeleton: "detail" },
  "places-map": { shell: "map", skeleton: "map" },
  "places-detail-map": { shell: "map", skeleton: "map" },
  "places-map-detail": { shell: "map", skeleton: "map" },
  "guides-index": { shell: "collection", skeleton: "collection" },
  "guides-detail": { shell: "detail", skeleton: "detail" },
  community: { shell: "collection", skeleton: "collection" },
  "movies-index": { shell: "collection", skeleton: "collection" },
  "movies-genre": { shell: "detail", skeleton: "detail" },
  "movies-list": { shell: "detail", skeleton: "detail" },
  "books-index": { shell: "collection", skeleton: "collection" },
  "books-subject": { shell: "detail", skeleton: "detail" },
  "books-list": { shell: "detail", skeleton: "detail" },
  "games-index": { shell: "collection", skeleton: "collection" },
  "games-genre": { shell: "detail", skeleton: "detail" },
  "games-list": { shell: "detail", skeleton: "detail" },
  "apps-index": { shell: "collection", skeleton: "collection" },
  "apps-list": { shell: "detail", skeleton: "detail" },
  "products-index": { shell: "collection", skeleton: "collection" },
  "products-list": { shell: "detail", skeleton: "detail" },
  "people-index": { shell: "collection", skeleton: "collection" },
  "people-sector": { shell: "detail", skeleton: "detail" },
  "people-list": { shell: "detail", skeleton: "detail" },
};

describe("PublicRouteSkeleton", () => {
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
  });

  it("maps every explicit route ID to its approved shell and skeleton geometry", () => {
    expect(Object.fromEntries(
      publicRouteContract.map(({ id, shell, skeleton }) => [id, { shell, skeleton }]),
    )).toEqual(expectedRouteGeometry);
  });

  it.each(kinds)("renders one themed %s skeleton with family-specific geometry", (kind) => {
    const { container } = render(<PublicRouteSkeleton kind={kind} />);

    const skeleton = screen.getByTestId(`public-route-skeleton-${kind}`);
    expect(skeleton).toHaveAttribute("data-public-route-skeleton", kind);
    expect(skeleton).toHaveClass("w-full", "max-w-full", "overflow-x-hidden");
    expect(skeleton).toHaveStyle({
      backgroundColor: "var(--bg-page)",
      color: "var(--text-primary)",
    });
    expect(container.querySelectorAll("[data-public-route-skeleton]")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading profile section");
  });

  it("does not wrap a map skeleton in profile identity geometry", () => {
    render(<PublicRouteSkeleton kind="map" />);

    expect(screen.getByTestId("public-route-skeleton-map-canvas")).toBeInTheDocument();
    expect(screen.queryByTestId("public-route-skeleton-profile-avatar")).not.toBeInTheDocument();
  });

  it.each([
    [320, 800],
    [375, 812],
    [375, 667],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ])("remains horizontally bounded at %ix%i CSS pixels", (width, height) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });

    const { container } = render(<PublicRouteSkeleton kind="collection" />);
    const skeleton = container.firstElementChild;

    expect(skeleton).toHaveClass("overflow-x-hidden", "max-w-full");
    expect(container.querySelector("[data-skeleton-wide-grid]")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
  });
});
