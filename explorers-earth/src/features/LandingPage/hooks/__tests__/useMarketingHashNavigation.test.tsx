import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import useMarketingHashNavigation from "../useMarketingHashNavigation";

function Harness() {
  useMarketingHashNavigation();
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => navigate("/use-cases#creators")}>Navigate</button>
      <section id="creators">Creators</section>
    </>
  );
}

describe("useMarketingHashNavigation", () => {
  it("scrolls to a decoded target after route navigation", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const { getByRole } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "Navigate" }).click());

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("ignores a malformed hash without throwing", () => {
    expect(() =>
      render(
        <MemoryRouter initialEntries={["/use-cases#%E0%A4%A"]}>
          <Harness />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});
