import { canReadPublicCategory, type PublicCategory } from "./publicProfilePolicy";

export interface PublicProfileGateway {
  resolveAccount(username: string): Promise<Record<string, unknown> | undefined>;
  resolveCategory(username: string, category: PublicCategory, limit: number): Promise<unknown>;
}

export class PublicProfileService {
  constructor(private readonly gateway: PublicProfileGateway) {}

  async category(username: string, category: PublicCategory, limit: number): Promise<unknown | undefined> {
    const account = await this.gateway.resolveAccount(username);
    if (!account || !canReadPublicCategory(account, category)) return undefined;
    return this.gateway.resolveCategory(username, category, limit);
  }

  async shell(username: string): Promise<Record<string, unknown> | undefined> {
    const account = await this.gateway.resolveAccount(username);
    return account?.public_profile === "Yes" ? account : undefined;
  }
}
