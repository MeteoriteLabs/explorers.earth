import { type PublicCategory } from "./publicProfilePolicy";

type FetchLike = typeof fetch;

type StrapiGraphqlResponse<T> = {
  data?: T;
  errors?: unknown[];
};

const PUBLIC_ACCOUNT_SELECTION = `
  Account_Name
  Account_Type
  Primary_Address
  Bio
  bg_picture { url alternativeText }
  createdAt
  documentId
  profile_picture { url alternativeText }
  social_media
  Public_Profile_Address
  Feed_Data
  public_profile
  public_recommendations
  public_music
  public_movie
  public_books
  public_guides
  public_games
  public_apps
  public_products
  public_people
  pinned_nav_tabs
  auto_pinning
`;

export class StrapiPublicProfileGateway {
  constructor(private readonly options: { origin: string; token: string; fetchImpl: FetchLike }) {}

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.options.fetchImpl(`${this.options.origin}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.token}` },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error("PUBLIC_PROFILE_UPSTREAM_FAILED");
    const body = await response.json() as StrapiGraphqlResponse<T>;
    if (body.errors?.length || body.data === undefined || body.data === null) {
      throw new Error("PUBLIC_PROFILE_UPSTREAM_FAILED");
    }
    return body.data;
  }

  async resolveCategory(username: string, category: PublicCategory, limit: number): Promise<unknown> {
    const documents: Record<PublicCategory, string> = {
      places: "recommendationLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility List_Name_Details recommended_places(pagination:{limit:4}){documentId media_details Media{url} Place_Details}}",
      movies: "movieLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility cover_image{url} recommended_movies(pagination:{limit:4}){documentId poster_path}}",
      books: "bookLists(filters:{account:{username:{eq:$username}},visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug visibility cover_image{url} recommended_books(pagination:{limit:4}){documentId cover_url}}",
      games: "gameLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility cover_image{url} recommended_games(pagination:{limit:4}){documentId cover_url media_details}}",
      guides: "guides(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId Title slug Visibility Guide_Media{url}}",
      apps: "appLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility cover_image{url} recommended_apps(pagination:{limit:4}){documentId logo_url}}",
      products: "productLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility cover_image{url} recommended_products(pagination:{limit:4}){documentId logo_url images}}",
      people: "personLists(filters:{account:{username:{eq:$username}},Visibility:{eq:true}},sort:[\"display_order:asc\"],pagination:{limit:$limit}){documentId List_Name slug Visibility recommended_people(pagination:{limit:4}){documentId avatar_path media_details}}",
    };
    return this.request(`query PublicCategory($username: String!, $limit: Int!) { ${documents[category]} }`, { username, limit });
  }

  async resolveAccount(username: string): Promise<Record<string, unknown> | undefined> {
    const data = await this.request<{ accounts?: Record<string, unknown>[] }>(`query PublicAccount($username: String!) { accounts(filters: { username: { eq: $username } }, pagination: { limit: 1 }) { ${PUBLIC_ACCOUNT_SELECTION} } }`, { username });
    return data.accounts?.[0];
  }
}
