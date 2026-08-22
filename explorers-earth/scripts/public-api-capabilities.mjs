export const ACCOUNT_BOOTSTRAP = {
  id: "account-bootstrap",
  operationName: "PublicAccountBootstrap",
  query: `query PublicAccountBootstrap($username: String!) { accounts(filters: { and: [{ Account_Name: { eq: $username } }, { public_profile: { eq: "Yes" } }] }) { documentId public_profile public_recommendations public_music public_movie public_books public_guides public_games public_apps public_products public_people } }`,
  variables: (username) => ({ username }),
  path: ["accounts"],
  runtimeOperationNames: [
    "PublicProfileBootstrap",
    "PublicCategoryListCounts",
    "PublicProfileContent",
    "PublicAccountBasic",
    "UsersPermissionsUser",
  ],
};

const COLLECTIONS = [
  ["places", "recommendationLists", "public_recommendations", "Visibility", ["PublicPlacesLists", "GetPlacesLists", "PublicPlaceListBySlug", "PublicRecommendedPlacesConnection", "Account"]],
  ["movies", "movieLists", "public_movie", "Visibility", ["PublicMovieData", "GetMoviesLists", "MovieListBySlug", "MoviesByGenre"]],
  ["books", "bookLists", "public_books", "visibility", ["PublicBookData", "GetBooksLists", "PublicBookLists", "BookListBySlug", "BooksBySubject"]],
  ["games", "gameLists", "public_games", "Visibility", ["PublicGameData", "GetGamesLists", "GameListBySlug", "GamesByGenre"]],
  ["guides", "guides", "public_guides", "Visibility", ["GetPublicGuides", "GetGuidesLists", "GetPublicGuideBySlug"]],
  ["apps", "appLists", "public_apps", "Visibility", ["PublicAppData", "GetAppsLists", "AppListBySlug"]],
  ["products", "productLists", "public_products", "Visibility", ["PublicProductData", "GetProductsLists", "ProductListBySlug"]],
  ["people", "personLists", "public_people", "Visibility", ["PublicPeopleData", "GetPeopleLists", "PersonListBySlug", "PeopleBySector"]],
];

export const PUBLIC_COLLECTION_OPERATIONS = COLLECTIONS.map(([id, field, enabledField, visibilityField, runtimeOperationNames]) => ({
  id,
  operationName: `Public${id[0].toUpperCase()}${id.slice(1)}`,
  enabledField,
  query: `query Public${id[0].toUpperCase()}${id.slice(1)}($accountDocumentId: ID!) { ${field}(filters: { account: { documentId: { eq: $accountDocumentId } }, ${visibilityField}: { eq: true } }, pagination: { limit: 1 }) { documentId } }`,
  variables: (accountDocumentId) => ({ accountDocumentId }),
  path: [field],
  runtimeOperationNames,
}));

export const PUBLIC_RUNTIME_OPERATION_CAPABILITIES = new Map(
  [ACCOUNT_BOOTSTRAP, ...PUBLIC_COLLECTION_OPERATIONS].flatMap((capability) =>
    capability.runtimeOperationNames.map((operationName) => [operationName, capability.id]),
  ),
);

export function enabledPublicOperations(account) {
  return PUBLIC_COLLECTION_OPERATIONS.filter((operation) => account[operation.enabledField] === true || account[operation.enabledField] === "Yes");
}
