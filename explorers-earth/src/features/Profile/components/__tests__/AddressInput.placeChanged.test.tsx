import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the place_changed listener and count Autocomplete constructions.
let placeChangedCb: (() => void) | null = null;
let constructCount = 0;

const fakePlace = {
  place_id: "p1",
  name: "Jaipur",
  geometry: { location: { lat: () => 1, lng: () => 2 } },
  formatted_address: "Jaipur, Rajasthan, India",
  address_components: [],
};

class FakeAutocomplete {
  constructor() {
    constructCount += 1;
  }
  addListener(evt: string, cb: () => void) {
    if (evt === "place_changed") placeChangedCb = cb;
  }
  getPlace() {
    return fakePlace;
  }
}

vi.mock("@vis.gl/react-google-maps", () => {
  // Return a STABLE library reference so placesLibrary identity doesn't change
  // across renders (mirrors real useMapsLibrary behavior). Built lazily so the
  // FakeAutocomplete class is initialized by the time it's referenced.
  let lib: { Autocomplete: typeof FakeAutocomplete } | null = null;
  return {
    useMapsLibrary: () => {
      if (!lib) lib = { Autocomplete: FakeAutocomplete };
      return lib;
    },
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../assets/icons/CurrLocation", () => ({
  default: () => null,
}));

// setPlaces uses type "title"/"listName" → the metadata axios.get path runs.
// Reject it so the fallback still calls setPlaces synchronously enough for the test.
vi.mock("axios", () => ({
  default: { get: vi.fn().mockRejectedValue(new Error("no network")) },
}));

// Google event API used in the effect cleanup.
(globalThis as unknown as { google: unknown }).google = {
  maps: { event: { clearInstanceListeners: vi.fn() } },
};

import AddressInput from "../AddressInput";

describe("AddressInput place_changed (BUG-4)", () => {
  beforeEach(() => {
    placeChangedCb = null;
    constructCount = 0;
  });

  it("builds the Autocomplete once across a parent re-render and captures the selection", async () => {
    const setPlaces = vi.fn();
    const onChange = vi.fn();

    const { rerender } = render(
      <AddressInput
        type="listName"
        label="x"
        setPlaces={setPlaces}
        onChange={onChange}
        placeHolder="p"
      />
    );

    // A keystroke-driven re-render gives new closure identities for the callbacks.
    rerender(
      <AddressInput
        type="listName"
        label="x"
        setPlaces={(...a) => setPlaces(...a)}
        onChange={(...a) => onChange(...a)}
        placeHolder="p"
      />
    );

    // The Autocomplete must NOT be rebuilt on re-render.
    expect(constructCount).toBe(1);
    expect(placeChangedCb).toBeTruthy();

    // Fire the Google selection; the fallback (axios rejects) still reports the place.
    await act(async () => {
      placeChangedCb!();
      await Promise.resolve();
    });

    expect(setPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: "p1" })
    );
  });
});
