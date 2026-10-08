import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

// Ticket 5.4 / decision D4. The claimable-place search ran two Strapi lookups and, when
// neither matched, said "No account found with the provided details." Once Strapi is gone
// that message is a lie with a consequence: a business owner whose place IS claimable is
// told it is not, and has no reason to ask anyone.
//
// This is the whole change, so it is the thing to pin: the page must say the feature is
// unavailable, must say so without claiming anything about the place, and must reach no
// network to find out. Whether a canonical claim flow is rebuilt is still D4's.

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../features/Profile/components/AddressInput", () => ({
  default: () => <input aria-label="Address" />,
}));
vi.mock("../../features/Authentication/components/PlaceProfileCard", () => ({ default: () => null }));

import ClaimAccount from "../ClaimAccount";

function renderClaim() {
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><ClaimAccount /></MemoryRouter>);
  return fetchMock;
}

it("tells a claimant the feature is unavailable instead of that no account was found", async () => {
  const fetchMock = renderClaim();

  const phone = screen.getByPlaceholderText(/phone/i);
  fireEvent.change(phone, { target: { value: "9999999999" } });
  fireEvent.click(screen.getByRole("button", { name: /search|find/i }));

  const alert = await waitFor(() => screen.getByRole("alert"));
  expect(alert).toHaveTextContent(/temporarily unavailable/i);
  // The distinction the old message destroyed: unavailable is not the same as unclaimable,
  // and the page has to say which one it means.
  expect(alert).toHaveTextContent(/does not mean your place is unclaimable/i);
  expect(screen.queryByText(/no account found/i)).not.toBeInTheDocument();

  // And it reaches nothing to say so - no Strapi lookup, and no upload endpoint carrying a
  // bundled public credential.
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does not advance to the profile or verification steps", async () => {
  renderClaim();

  fireEvent.change(screen.getByPlaceholderText(/phone/i), { target: { value: "9999999999" } });
  fireEvent.click(screen.getByRole("button", { name: /search|find/i }));
  await waitFor(() => screen.getByRole("alert"));

  // Step 2 is where a verification document was uploaded. It must stay unreachable.
  expect(screen.queryByText(/verify yourself/i)?.closest("[data-active='true']")).toBeFalsy();
  expect(screen.queryByLabelText(/upload/i)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /find your explorers account/i })).toBeInTheDocument();
});
