import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AddProductPage from "../components/dashboard/AddProductPage";
import { PRODUCTS_BY_LIST, PRODUCT_CATEGORIES } from "../api/query";

vi.mock("../../../../store/store", () => ({
  default: () => ({ user: { username: "testuser" }, token: "mock-token" }),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: new Blob(["x"], { type: "image/png" }) }),
    post: vi.fn().mockResolvedValue({ data: [{ url: "https://s3/logo.png" }] }),
  },
}));

const productCategoriesMock = {
  request: { query: PRODUCT_CATEGORIES },
  result: { data: { productCategories: [] } },
};
const productsByListMock = {
  request: {
    query: PRODUCTS_BY_LIST,
    variables: { productListDocumentId: "list_123", page: 0, pageSize: 200 },
  },
  result: {
    data: {
      productLists: [
        {
          documentId: "list_123",
          List_Name: "My List",
          slug: "my-list",
          Visibility: false,
          display_order: 0,
          recommended_products: [],
        },
      ],
    },
  },
};

const renderPage = () =>
  render(
    <MockedProvider mocks={[productCategoriesMock, productsByListMock]} addTypename={false}>
      <MemoryRouter initialEntries={["/recommendations/products/list_123/add"]}>
        <Routes>
          <Route
            path="/recommendations/products/:listId/add"
            element={<AddProductPage />}
          />
        </Routes>
      </MemoryRouter>
    </MockedProvider>
  );

const scrape = async () => {
  fireEvent.change(screen.getByPlaceholderText(/amazon.com/), {
    target: { value: "https://amazon.com/dp/1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fetch" }));
};

describe("AddProductPage scraped price guard (BUG-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("fills a suspicious price but flags it as unverified (persistent, not a toast)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Sony WH-1000XM5",
        price: 16.7, // installment price — clearly wrong vs the ~399 real price
        currency: "EUR",
      }),
    });

    renderPage();
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Product name")).toHaveValue(
        "Sony WH-1000XM5"
      );
    });

    // Price is populated (not silently discarded)...
    expect(screen.getByPlaceholderText("79.99")).toHaveValue(16.7);
    // ...but flagged for verification with a persistent inline indicator.
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
  });

  it("drops an unsupported scraped currency and falls back to USD", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Widget",
        price: 42,
        currency: "XYZ", // not in the currency <select>
      }),
    });

    renderPage();
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Product name")).toHaveValue("Widget");
    });

    const currencySelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(currencySelect.value).toBe("USD");
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
  });

  it("ignores a non-positive scraped price", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Freebie", price: 0, currency: "USD" }),
    });

    renderPage();
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Product name")).toHaveValue("Freebie");
    });

    // 0 is not a valid price → the field stays empty.
    expect(screen.getByPlaceholderText("79.99")).toHaveValue(null);
  });

  it("keeps the prior scraped price flagged after a rescrape that omits price/currency", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Sony", price: 16.7, currency: "EUR" }),
    });

    renderPage();
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("79.99")).toHaveValue(16.7);
    });
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();

    // Go back to the URL step (header back button is the first button).
    fireEvent.click(screen.getAllByRole("button")[0]);

    // A second scrape that returns NO price/currency (e.g. a page with no price).
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Sony (rescraped)" }),
    });
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Product name")).toHaveValue(
        "Sony (rescraped)"
      );
    });

    // The prior scraped price is preserved AND still flagged as unverified —
    // the warning must NOT be cleared just because the rescrape omitted price.
    expect(screen.getByPlaceholderText("79.99")).toHaveValue(16.7);
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
  });

  it("keeps the warning when the user only edits the currency (not the suspect price)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Sony", price: 16.7, currency: "EUR" }),
    });

    renderPage();
    await scrape();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("79.99")).toHaveValue(16.7);
    });
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();

    // Editing the CURRENCY does not resolve the suspect PRICE → warning persists.
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "GBP" } });
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("79.99")).toHaveValue(16.7);

    // Editing the PRICE itself clears the warning.
    fireEvent.change(screen.getByPlaceholderText("79.99"), {
      target: { value: "399" },
    });
    expect(screen.queryByText(/Unverified/i)).toBeNull();
  });
});
