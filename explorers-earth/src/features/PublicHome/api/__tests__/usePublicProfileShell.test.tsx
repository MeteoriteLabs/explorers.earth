import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { shell } = vi.hoisted(() => ({ shell: vi.fn() }));

vi.mock("../publicProfileGatewayClient", () => ({
  publicProfileGatewayClient: { shell },
}));

import { usePublicProfileShell } from "../usePublicProfileShell";

describe("usePublicProfileShell", () => {
  beforeEach(() => shell.mockReset());

  it("loads the shell only from the public-profile gateway", async () => {
    shell.mockResolvedValueOnce({ Account_Name: "Alice" });
    const { result } = renderHook(() => usePublicProfileShell("tk2727"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(shell).toHaveBeenCalledWith("tk2727", expect.any(AbortSignal), false);
    expect(result.current.data).toEqual({ Account_Name: "Alice" });
  });
});
