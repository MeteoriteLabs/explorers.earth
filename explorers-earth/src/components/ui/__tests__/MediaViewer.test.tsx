import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MediaViewer from "../MediaViewer";

describe("MediaViewer keyboard boundary", () => {
  beforeEach(() => {
    class ObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ObserverMock);
    vi.stubGlobal("IntersectionObserver", ObserverMock);
  });

  it("delegates Escape to the real lightbox close callback", async () => {
    const onClose = vi.fn();

    render(
      <MediaViewer
        isOpen
        onClose={onClose}
        mediaItems={[
          {
            id: "avatar-1",
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
            alt: "Alice's profile photo",
            type: "image",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
    const controller = document.querySelector(".yarl__container");
    expect(controller).not.toBeNull();
    fireEvent.keyDown(controller!, {
      key: "Escape",
      code: "Escape",
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
