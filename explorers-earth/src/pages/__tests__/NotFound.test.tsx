import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import PageNotFound from "../NotFound";

describe("PageNotFound", () => {
  afterEach(() => {
    document.title = "";
  });

  it("owns the document title and exposes one descriptive primary heading", () => {
    render(
      <MemoryRouter>
        <PageNotFound />
      </MemoryRouter>,
    );

    expect(document.title).toBe("Page Not Found | explorers");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("Page Not Found");
  });
});
