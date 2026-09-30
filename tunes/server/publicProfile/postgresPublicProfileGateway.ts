import type { Pool } from "pg";
import type { PublicProfileGateway } from "./publicProfileService";
import type { PublicCategory } from "./publicProfilePolicy";

const flag: Record<string, string> = { places: "public_recommendations", guides: "public_guides", music: "public_music",
  movies: "public_movie", books: "public_books", games: "public_games", apps: "public_apps",
  products: "public_products", people: "public_people" };

/** Compatibility shell only; category content remains an Epic 3/7 dependency. */
export class PostgresPublicProfileGateway implements PublicProfileGateway {
  constructor(private readonly db: Pool) {}

  async resolveAccount(username: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.db.query(`SELECT a.id,a.handle,a.display_name,a.account_type,a.bio_plain,a.bio_rich,
      a.public_address,a.profile_place_details,a.public_profile,a.auto_pinning,a.mobile_number,a.mobile_number_visible,
      a.created_at,p.social_links,pm_profile.media_id AS profile_media_id,pm_background.media_id AS background_media_id
      FROM creator_accounts a JOIN account_presentation p ON p.account_id=a.id
      LEFT JOIN profile_media pm_profile ON pm_profile.account_id=a.id AND pm_profile.slot='profile'
      LEFT JOIN profile_media pm_background ON pm_background.account_id=a.id AND pm_background.slot='background'
      WHERE a.handle_key=lower($1) AND a.status='active' AND a.onboarding_status='complete' AND a.public_profile=true`, [username]);
    const a = result.rows[0];
    if (!a) return undefined;
    const settings = await this.db.query("SELECT category,is_public,pinned_order FROM account_category_settings WHERE account_id=$1", [a.id]);
    const visibleLinks = Array.isArray(a.social_links) ? a.social_links.filter((link: any) => link?.visible === true)
      .map((link: any) => ({ platform: link.platform, url: link.url, visible: true })) : [];
    const publicShell: Record<string, unknown> = {
      documentId: a.id, username: a.handle, Account_Name: a.display_name, Account_Type: a.account_type,
      Bio: a.bio_rich, Bio_1: a.bio_plain, Public_Profile_Address: a.public_address,
      profile_place_details: a.profile_place_details, public_profile: "Yes", auto_pinning: a.auto_pinning,
      createdAt: a.created_at, social_media: visibleLinks,
      profile_picture: a.profile_media_id ? { url: `/api/explorers/v1/media/${a.profile_media_id}/content` } : null,
      bg_picture: a.background_media_id ? { url: `/api/explorers/v1/media/${a.background_media_id}/content` } : null,
      ...(a.mobile_number_visible ? { mobile_number: a.mobile_number, mobile_number_visibility: true } : {}),
    };
    for (const [category, legacyFlag] of Object.entries(flag)) publicShell[legacyFlag] = settings.rows.some((row) => row.category === category && row.is_public) ? "Yes" : "No";
    publicShell.pinned_nav_tabs = settings.rows.filter((row) => row.pinned_order !== null).sort((x, y) => x.pinned_order - y.pinned_order).map((row) => row.category);
    return publicShell;
  }

  async resolveCategory(_username: string, _category: PublicCategory): Promise<unknown> { return { items: [], nextCursor: null }; }
  async resolveDetail(): Promise<unknown> { return undefined; }
}
