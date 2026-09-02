import { type PublicCategory } from "./publicProfilePolicy";

type FetchLike = typeof fetch;

export class StrapiPublicProfileGateway {
  constructor(private readonly options: { origin: string; token: string; fetchImpl: FetchLike }) {}

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
    const response = await this.options.fetchImpl(`${this.options.origin}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.token}` },
      body: JSON.stringify({
        query: `query PublicCategory($username: String!, $limit: Int!) { ${documents[category]} }`,
        variables: { username, limit },
      }),
    });
    if (!response.ok) throw new Error("PUBLIC_PROFILE_UPSTREAM_FAILED");
    return response.json();
  }

  async resolveAccount(username: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.options.fetchImpl(`${this.options.origin}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.token}` },
      body: JSON.stringify({ query: "query PublicAccount($username: String!) { accounts(filters: { username: { eq: $username } }, pagination: { limit: 1 }) { public_profile public_recommendations public_movie public_books public_games public_guides public_apps public_products public_people } }", variables: { username } }),
    });
    if (!response.ok) throw new Error("PUBLIC_PROFILE_UPSTREAM_FAILED");
    const body = await response.json() as { data?: { accounts?: Record<string, unknown>[] } };
    return body.data?.accounts?.[0];
  }
}
