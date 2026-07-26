import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// AddressInput pulls in the Google Maps hook — stub it out.
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("../../../store/store", () => ({
  default: () => ({ user: { username: "qa" }, token: "t" }),
}));
vi.mock("../../../features/Profile/components/AddressInput", () => ({
  default: () => null,
}));

import AddLocationModal from "../AddLocationModal";

// Editing mode skips the "select a place" guard, so we can drive submit purely
// from the returned boolean contract.
const baseProps = {
  isOpen: true,
  isEditing: true,
  existingPlaces: [],
  initialValues: { listName: "Paris", placeUrl: "paris" },
};

describe("AddLocationModal submit contract (BUG-5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the modal OPEN when the submitter returns false", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(false);

    render(<AddLocationModal {...baseProps} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Update Location" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // The submit failed → modal must not close.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the modal OPEN when the submitter rejects", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AddLocationModal {...baseProps} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Update Location" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the modal only on explicit success (true)", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(<AddLocationModal {...baseProps} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Update Location" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
