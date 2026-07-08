import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddressInput from "../AddressInput";

vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../assets/icons/CurrLocation", () => ({
  default: () => null,
}));

describe("AddressInput", () => {
  it("notifies the parent form when the user types manually", () => {
    const handleChange = vi.fn();

    render(
      <AddressInput
        label="Search Location"
        onChange={handleChange}
        placeHolder="Enter city"
        type="listName"
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Enter city"), {
      target: { value: "Bengaluru" },
    });

    expect(handleChange).toHaveBeenCalledWith("Bengaluru");
  });
});
