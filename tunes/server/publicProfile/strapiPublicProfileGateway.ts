import { type PublicCategory } from "./publicProfilePolicy";

type FetchLike = typeof fetch;

export class StrapiPublicProfileGateway {
  constructor(private readonly options: { origin: string; token: string; fetchImpl: FetchLike }) {}

  async resolveCategory(username: string, category: PublicCategory, limit: number): Promise<unknown> {
    const collection: Record<PublicCategory, string> = {
      places: "recommendationLists", movies: "movieLists", books: "bookLists", games: "gameLists",
      guides: "guides", apps: "appLists", products: "productLists", people: "personLists",
    };
    const response = await this.options.fetchImpl(`${this.options.origin}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.token}` },
      body: JSON.stringify({
        query: `query PublicCategory($username: String!, $limit: Int!) { ${collection[category]}(filters: { account: { username: { eq: $username } } }, pagination: { limit: $limit }) { documentId } }`,
        variables: { username, limit },
      }),
    });
    if (!response.ok) throw new Error("PUBLIC_PROFILE_UPSTREAM_FAILED");
    return response.json();
  }
}
