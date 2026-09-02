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
  mobile_number_visibility
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

  async resolveDetail(username: string, category: PublicCategory, slug: string, limit: number): Promise<unknown> {
    const documents: Record<PublicCategory, string> = {
      places: `recommendationLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name List_Name_Details slug Visibility cover_image{url alternativeText} recommended_places(sort:["display_order:asc"],pagination:{limit:$limit}){documentId Place_Details Recommendation_Type Contact_Name media_details Media{url alternativeText} recommendation_category{Category_Name}}}`,
      movies: `movieLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug Visibility cover_image{url alternativeText} display_order top_picks_heading recommended_movies(sort:["display_order:asc"],pagination:{limit:$limit}){documentId tmdb_id media_type title poster_path backdrop_path year genres tmdb_rating user_rating overview watch_providers is_pinned pin_order user_recommendation_note cast_details media_details Media{documentId url caption}}}`,
      books: `bookLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug visibility cover_image{url alternativeText} display_order top_reads_heading recommended_books(sort:["display_order:asc"],pagination:{limit:$limit}){documentId volume_id title subtitle authors year cover_url cover_url_large subjects google_rating user_rating description user_recommendation_note buy_links is_pinned pin_order media_details Media{documentId url caption}}}`,
      games: `gameLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug Visibility cover_image{url alternativeText} top_picks_heading recommended_games(sort:["display_order:asc"],pagination:{limit:$limit}){documentId igdb_id title cover_url summary release_year platforms genres screenshot_ids media_details igdb_rating user_rating is_pinned pin_order Media{documentId url} game_categories{documentId genre_name}}}`,
      guides: `guides(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId Title Description Guide_Type Visibility Estimated_Budget Budget_Type is_Multicity slug Guide_Media{url name alternativeText} Place_Details Number_Of_Days Category Best_Time_To_Visit Guide_Tags Tips_Notes Guide_Section_Details is_pinned pin_order display_order createdAt updatedAt guide_sections(pagination:{limit:$limit},sort:["Sequence:asc"]){documentId Title Sequence Description Timeline Transport Stay Recommendation_Activity Map_Details Packing_List Pre_Tasks Section_tags Budget}}`,
      apps: `appLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug Visibility cover_image{url alternativeText} top_apps_heading recommended_apps(sort:["display_order:asc"],pagination:{limit:$limit}){documentId app_url title description logo_url developer platforms price_tier download_url is_pinned display_order screenshots user_recommendation_note user_rating pin_order app_category{documentId name slug}}}`,
      products: `productLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug Visibility cover_image{url alternativeText} top_products_heading recommended_products(sort:["display_order:asc"],pagination:{limit:$limit}){documentId product_url title logo_url brand price currency buy_url images description specifications user_recommendation_note user_rating is_pinned pin_order product_category{documentId name slug}}}`,
      people: `personLists(filters:{account:{username:{eq:$username}},slug:{eq:$slug},Visibility:{eq:true}},pagination:{limit:1}){documentId List_Name list_description slug Visibility cover_image{url alternativeText} top_picks_heading recommended_people(sort:["display_order:asc"],pagination:{limit:$limit}){documentId name username_handle headline location avatar_path media_details primary_platform social_urls skills_tags user_recommendation_note user_rating is_pinned pin_order people_category{documentId Category_name}}}`,
    };
    return this.request(
      `query Public${category}Detail($username: String!, $slug: String!, $limit: Int!) { ${documents[category]} }`,
      { username, slug, limit },
    );
  }

  async resolveAccount(username: string): Promise<Record<string, unknown> | undefined> {
    const data = await this.request<{ accounts?: Record<string, unknown>[] }>(`query PublicAccount($username: String!) { accounts(filters: { username: { eq: $username } }, pagination: { limit: 1 }) { ${PUBLIC_ACCOUNT_SELECTION} } }`, { username });
    return data.accounts?.[0];
  }
}
