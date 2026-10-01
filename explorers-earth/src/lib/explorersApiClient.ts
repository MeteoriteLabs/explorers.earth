import type { AccountDto, MediaDto, RevisionInput, UpdateAccountInput } from "../../../tunes/shared/explorersContract";
import useAuthStore from "../store/store";

export class ExplorersApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

function handleExpiredSession(response: Response, generation: number) {
  if (response.status !== 401) return;
  const current = useAuthStore.getState();
  if (current.generation === generation && current.isAuthenticated) current.logout();
}

async function responseBody<T>(response: Response, generation: number): Promise<T> {
  handleExpiredSession(response, generation);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ExplorersApiError(response.status, body?.error?.code ?? "UNAVAILABLE",
    body?.error?.message ?? "Request failed");
  return body as T;
}

export const explorersApiClient = {
  async getMyProfile(signal?: AbortSignal): Promise<AccountDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/me", { credentials: "include", cache: "no-store", signal });
    return (await responseBody<{ account: AccountDto }>(response, generation)).account;
  },
  async updateAccount(input: UpdateAccountInput & RevisionInput, signal?: AbortSignal): Promise<AccountDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/account", { method: "PATCH", credentials: "include", signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return (await responseBody<{ account: AccountDto }>(response, generation)).account;
  },
  async createMedia(file: File, purpose: "profile" | "background" | "feed", signal?: AbortSignal): Promise<MediaDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/media", { method: "POST", credentials: "include", signal,
      headers: { "Content-Type": file.type, "X-Media-Purpose": purpose, "X-File-Name": file.name }, body: file });
    return (await responseBody<{ media: MediaDto }>(response, generation)).media;
  },
  async deleteMedia(id: string, signal?: AbortSignal): Promise<void> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch(`/api/explorers/v1/media/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "include", signal,
    });
    if (!response.ok) await responseBody<never>(response, generation);
  },
};
