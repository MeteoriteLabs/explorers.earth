import { describe, expect, it, vi } from "vitest";
import { PublicProfileService } from "../../publicProfile/publicProfileService";

describe("PublicProfileService", () => {
  it("does not return a category when its profile visibility is disabled", async () => {
    const gateway = { resolveAccount: vi.fn().mockResolvedValue({ public_profile: "Yes", public_apps: "No" }), resolveCategory: vi.fn() };
    const service = new PublicProfileService(gateway);
    await expect(service.category("tk2727", "apps", 12)).resolves.toBeUndefined();
    expect(gateway.resolveCategory).not.toHaveBeenCalled();
  });
});
