import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicMusicAvailabilityProvider, usePublicMusicAvailability } from "../PublicMusicAvailabilityProvider";

const discover = vi.hoisted(() => vi.fn());
const useQuery = vi.hoisted(() => vi.fn());
vi.mock("@apollo/client", async (importOriginal) => ({ ...(await importOriginal<object>()), useQuery }));
vi.mock("../publicMusicClient", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publicMusicClient: { discover },
}));

function Consumer({ label }: { label: string }) {
  const availability = usePublicMusicAvailability();
  return <div>{label}:{availability.state}:{availability.descriptor?.publication.publicSlug ?? "none"}</div>;
}

function OrderedConsumer() {
  const availability = usePublicMusicAvailability();
  return <div><span>page:{availability.state === "revoked" ? "unavailable" : availability.state}</span><span>nav:{availability.state === "available" || availability.state === "revalidating" || availability.state === "revoked" ? "eligible" : "removed"}</span></div>;
}
function RetryConsumer() {
  const availability = usePublicMusicAvailability();
  return <><button onClick={availability.retry}>retry</button><div>retry:{availability.state}:{availability.descriptor?.publication.publicSlug ?? "none"}</div></>;
}

function renderProvider() {
  return render(
    <MemoryRouter initialEntries={["/alice/music"]}>
      <Routes><Route path=":username/music" element={
        <PublicMusicAvailabilityProvider><Consumer label="nav" /><Consumer label="page" /><Consumer label="landing" /></PublicMusicAvailabilityProvider>
      } /></Routes>
    </MemoryRouter>,
  );
}

describe("PublicMusicAvailabilityProvider", () => {
  beforeEach(() => {
    discover.mockReset();
    useQuery.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("shares one Account-document descriptor request across all consumers", async () => {
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "Yes" }] }, loading: false });
    discover.mockResolvedValue({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "public_slug-123", revision: 1 } });
    renderProvider();
    await waitFor(() => expect(screen.getByText("nav:available:public_slug-123")).toBeInTheDocument());
    expect(screen.getByText("page:available:public_slug-123")).toBeInTheDocument();
    expect(screen.getByText("landing:available:public_slug-123")).toBeInTheDocument();
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover).toHaveBeenCalledWith("account-doc", expect.any(AbortSignal));
  });

  it("fails closed without contacting Local Tunes when profile Music is hidden", () => {
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "No" }] }, loading: false });
    renderProvider();
    expect(screen.getByText("nav:not-public:none")).toBeInTheDocument();
    expect(discover).not.toHaveBeenCalled();
  });

  it("expires availability, refetches canonically, and removes revoked eligibility", async () => {
    vi.useFakeTimers();
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "Yes" }] }, loading: false });
    discover.mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "public_slug-123", revision: 1 } })
      .mockRejectedValueOnce(Object.assign(new Error("PUBLIC_NOT_FOUND"), { code: "PUBLIC_NOT_FOUND" }));
    renderProvider();
    await vi.waitFor(() => expect(screen.getByText("nav:available:public_slug-123")).toBeInTheDocument());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await vi.waitFor(() => expect(screen.getByText("nav:not-public:none")).toBeInTheDocument());
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it("retains stale eligibility while revalidating and exposes terminal page state before removal", async () => {
    vi.useFakeTimers();
    let rejectRevocation!: (reason: unknown) => void;
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "Yes" }] }, loading: false });
    discover.mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "public_slug-123", revision: 1 } })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRevocation = reject; }));
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes><Route path=":username/music" element={<PublicMusicAvailabilityProvider><OrderedConsumer /></PublicMusicAvailabilityProvider>} /></Routes></MemoryRouter>);
    await vi.waitFor(() => expect(screen.getByText("page:available")).toBeInTheDocument());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("page:revalidating")).toBeInTheDocument();
    expect(screen.getByText("nav:eligible")).toBeInTheDocument();
    await act(async () => rejectRevocation(Object.assign(new Error("PUBLIC_NOT_FOUND"), { code: "PUBLIC_NOT_FOUND" })));
    expect(screen.getByText("page:unavailable")).toBeInTheDocument();
    expect(screen.getByText("nav:eligible")).toBeInTheDocument();
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(screen.getByText("nav:removed")).toBeInTheDocument();
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it("never renders account A state or slug after the query switches to account B", async () => {
    let query = { data: { accounts: [{ documentId: "account-a", public_music: "Yes" }] }, loading: false };
    useQuery.mockImplementation(() => query);
    discover.mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "slug-a", revision: 1 } })
      .mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "slug-b", revision: 1 } });
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText("nav:available:slug-a")).toBeInTheDocument());
    query = { data: { accounts: [{ documentId: "account-b", public_music: "Yes" }] }, loading: false };
    view.rerender(<MemoryRouter initialEntries={["/bob/music"]}><Routes><Route path=":username/music" element={<PublicMusicAvailabilityProvider><Consumer label="nav" /></PublicMusicAvailabilityProvider>} /></Routes></MemoryRouter>);
    expect(screen.queryByText(/slug-a/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("nav:available:slug-b")).toBeInTheDocument());
  });

  it("ignores an older request that settles after a retry", async () => {
    let resolveOld!: (value: any) => void;
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "Yes" }] }, loading: false });
    discover.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "new-slug", revision: 2 } });
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes><Route path=":username/music" element={<PublicMusicAvailabilityProvider><RetryConsumer /></PublicMusicAvailabilityProvider>} /></Routes></MemoryRouter>);
    act(() => screen.getByRole("button", { name: "retry" }).click());
    await waitFor(() => expect(screen.getByText("retry:available:new-slug")).toBeInTheDocument());
    await act(async () => resolveOld({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "old-slug", revision: 1 } }));
    expect(screen.queryByText(/old-slug/)).not.toBeInTheDocument();
  });

  it("cancels deferred revocation work on unmount", async () => {
    vi.useFakeTimers();
    let reject!: (reason: unknown) => void;
    useQuery.mockReturnValue({ data: { accounts: [{ documentId: "account-doc", public_music: "Yes" }] }, loading: false });
    discover.mockResolvedValueOnce({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "slug", revision: 1 } })
      .mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
    const view = renderProvider();
    await vi.waitFor(() => expect(screen.getByText("nav:available:slug")).toBeInTheDocument());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(async () => reject(Object.assign(new Error("PUBLIC_NOT_FOUND"), { code: "PUBLIC_NOT_FOUND" })));
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
