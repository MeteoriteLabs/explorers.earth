export const ACCOUNT_BOOTSTRAP = {
  id: "account-bootstrap",
  operationName: "PublicAccountBootstrap",
  query: `query PublicAccountBootstrap($username: String!) { accounts(filters: { and: [{ Account_Name: { eq: $username } }, { public_profile: { eq: "Yes" } }] }) { documentId public_profile public_recommendations public_music public_movie public_books public_guides public_games public_apps public_products public_people } }`,
  variables: (username) => ({ username }),
  path: ["accounts"],
};

const COLLECTIONS = [
  ["places", "recommendationLists", "public_recommendations", "Visibility"],
  ["movies", "movieLists", "public_movie", "Visibility"],
  ["books", "bookLists", "public_books", "visibility"],
  ["games", "gameLists", "public_games", "Visibility"],
  ["guides", "guides", "public_guides", "Visibility"],
  ["apps", "appLists", "public_apps", "Visibility"],
  ["products", "productLists", "public_products", "Visibility"],
  ["people", "personLists", "public_people", "Visibility"],
];

export const PUBLIC_COLLECTION_OPERATIONS = COLLECTIONS.map(([id, field, enabledField, visibilityField]) => ({
  id,
  operationName: `Public${id[0].toUpperCase()}${id.slice(1)}`,
  enabledField,
  query: `query Public${id[0].toUpperCase()}${id.slice(1)}($accountDocumentId: ID!) { ${field}(filters: { account: { documentId: { eq: $accountDocumentId } }, ${visibilityField}: { eq: true } }, pagination: { limit: 1 }) { documentId } }`,
  variables: (accountDocumentId) => ({ accountDocumentId }),
  path: [field],
}));

export function enabledPublicOperations(account) {
  return PUBLIC_COLLECTION_OPERATIONS.filter((operation) => account[operation.enabledField] === true || account[operation.enabledField] === "Yes");
}
