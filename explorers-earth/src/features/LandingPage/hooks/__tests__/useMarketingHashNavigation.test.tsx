import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import useMarketingHashNavigation from "../useMarketingHashNavigation";

const originalScrollIntoView = Element.prototype.scrollIntoView;

function mockAnimationFrames() {
  let nextId = 1;
  let callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const pending = callbacks;
      callbacks = new Map();
      pending.forEach((callback) => callback(0));
    },
  };
}

function Harness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useMarketingHashNavigation(reducedMotion);
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => navigate("/use-cases#creators")}>Navigate</button>
      <section id="creators">Creators</section>
    </>
  );
}

describe("useMarketingHashNavigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it("scrolls to a decoded target after route navigation", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const frames = mockAnimationFrames();

    const { getByRole } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "Navigate" }).click());
    act(() => frames.flush());
    act(() => frames.flush());

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("cancels pending navigation when the page unmounts", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const frames = mockAnimationFrames();

    const { unmount } = render(
      <MemoryRouter initialEntries={["/use-cases#creators"]}>
        <Harness />
      </MemoryRouter>,
    );

    unmount();
    act(() => frames.flush());

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("avoids smooth scrolling when reduced motion is requested", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const frames = mockAnimationFrames();

    render(
      <MemoryRouter initialEntries={["/use-cases#creators"]}>
        <Harness reducedMotion />
      </MemoryRouter>,
    );

    act(() => frames.flush());
    act(() => frames.flush());

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
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
