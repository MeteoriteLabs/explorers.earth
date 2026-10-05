# Source inventory

Commit `79ef17d0b88c7e11b49d618fc7c888a513f29fa8`. All tracked runtime TS/JS source; excludes test directories and test/spec files. Parse gql template literals; occurrences count separately, not unique names or proven live operations. TypeScript AST additionally identifies untagged operation strings/templates. REST lines are candidates, not registered endpoints.

## Tagged GraphQL operation counts

```json
{
  "Explorers": {
    "query": 108,
    "mutation": 86,
    "subscription": 0
  },
  "Tunes": {
    "query": 1,
    "mutation": 4,
    "subscription": 0
  }
}
```

Parse failures: 0. Untagged client and server GraphQL strings/templates are separately inventoried below; these counts exclude them. See the architecture report for combined totals.

## GraphQL declarations

| Kind | Name | Root fields | Source |
|---|---|---|---|
| query | MusicIdentityEligibility | usersPermissionsUser | explorers-earth/src/components/AuthSyncManager.tsx:11 |
| query | user | usersPermissionsUser | explorers-earth/src/components/Header.tsx:24 |
| query | CheckOnboardingStatus | usersPermissionsUser | explorers-earth/src/components/ProtectedRoute.tsx:13 |
| query | SidebarAccount | usersPermissionsUser | explorers-earth/src/components/Sidenav.tsx:21 |
| query | GetAccountId | usersPermissionsUser | explorers-earth/src/features/Analytics/components/AnalyticsDashboard.tsx:66 |
| mutation | CreateAppList | createAppList | explorers-earth/src/features/AppsAndTools/api/mutation.ts:6 |
| mutation | UpdateAppList | updateAppList | explorers-earth/src/features/AppsAndTools/api/mutation.ts:40 |
| mutation | DeleteAppList | deleteAppList | explorers-earth/src/features/AppsAndTools/api/mutation.ts:76 |
| mutation | CreateRecommendedApp | createRecommendedApp | explorers-earth/src/features/AppsAndTools/api/mutation.ts:87 |
| mutation | UpdateRecommendedApp | updateRecommendedApp | explorers-earth/src/features/AppsAndTools/api/mutation.ts:138 |
| mutation | DeleteRecommendedApp | deleteRecommendedApp | explorers-earth/src/features/AppsAndTools/api/mutation.ts:188 |
| mutation | ToggleAppPin | updateRecommendedApp | explorers-earth/src/features/AppsAndTools/api/mutation.ts:199 |
| query | AppListsByAccount | appLists | explorers-earth/src/features/AppsAndTools/api/query.ts:6 |
| query | AppsByList | appLists | explorers-earth/src/features/AppsAndTools/api/query.ts:57 |
| query | PinnedApps | recommendedApps | explorers-earth/src/features/AppsAndTools/api/query.ts:115 |
| query | PublicAppData | appLists, recommendedApps | explorers-earth/src/features/AppsAndTools/api/query.ts:155 |
| query | AppListBySlug | appLists | explorers-earth/src/features/AppsAndTools/api/query.ts:219 |
| query | AppsByCategory | recommendedApps | explorers-earth/src/features/AppsAndTools/api/query.ts:269 |
| query | AppCategories | appCategories | explorers-earth/src/features/AppsAndTools/api/query.ts:307 |
| query | MyAccountForApps | usersPermissionsUser | explorers-earth/src/features/AppsAndTools/components/dashboard/AppsHome.tsx:30 |
| mutation | register | register | explorers-earth/src/features/Authentication/api/mutation.ts:4 |
| mutation | login | login | explorers-earth/src/features/Authentication/api/mutation.ts:20 |
| mutation | forgotPassword | forgotPassword | explorers-earth/src/features/Authentication/api/mutation.ts:36 |
| mutation | Mutation | resetPassword | explorers-earth/src/features/Authentication/api/mutation.ts:44 |
| mutation | CreateVerifyClaim | createVerifyClaim | explorers-earth/src/features/Authentication/api/queries.ts:4 |
| query | CheckClaimablePlaceProfileByPhone | claimablePlaceProfiles | explorers-earth/src/features/Authentication/api/queries.ts:25 |
| query | CheckClaimablePlaceProfileByAddress | claimablePlaceProfiles | explorers-earth/src/features/Authentication/api/queries.ts:51 |
| query | GetCurrentUser | usersPermissionsUser | explorers-earth/src/features/Authentication/api/userQueries.ts:7 |
| query | GetUserForOnboarding | usersPermissionsUser | explorers-earth/src/features/Authentication/api/userQueries.ts:25 |
| mutation | CreateBookList | createBookList | explorers-earth/src/features/Books/api/mutation.ts:6 |
| mutation | UpdateBookList | updateBookList | explorers-earth/src/features/Books/api/mutation.ts:40 |
| mutation | DeleteBookList | deleteBookList | explorers-earth/src/features/Books/api/mutation.ts:76 |
| mutation | CreateRecommendedBook | createRecommendedBook | explorers-earth/src/features/Books/api/mutation.ts:87 |
| mutation | UpdateRecommendedBook | updateRecommendedBook | explorers-earth/src/features/Books/api/mutation.ts:153 |
| mutation | DeleteRecommendedBook | deleteRecommendedBook | explorers-earth/src/features/Books/api/mutation.ts:191 |
| mutation | ToggleBookPin | updateRecommendedBook | explorers-earth/src/features/Books/api/mutation.ts:202 |
| query | BookListsByAccount | bookLists | explorers-earth/src/features/Books/api/query.ts:6 |
| query | BooksByList | bookLists | explorers-earth/src/features/Books/api/query.ts:61 |
| query | BookDetails | recommendedBooks | explorers-earth/src/features/Books/api/query.ts:131 |
| query | PinnedBooks | recommendedBooks | explorers-earth/src/features/Books/api/query.ts:177 |
| query | BooksBySubject | recommendedBooks | explorers-earth/src/features/Books/api/query.ts:223 |
| query | BookListBySlug | bookLists | explorers-earth/src/features/Books/api/query.ts:259 |
| query | PublicBookData | bookLists | explorers-earth/src/features/Books/api/query.ts:313 |
| query | BookCategories | bookCategories | explorers-earth/src/features/Books/api/query.ts:367 |
| query | MyAccountForBooks | usersPermissionsUser | explorers-earth/src/features/Books/components/dashboard/BooksHome.tsx:29 |
| mutation | CreateRecommendationList | createRecommendationList | explorers-earth/src/features/Favorites/api/mutation.ts:3 |
| mutation | CreateRecommendationCategory | createRecommendationCategory | explorers-earth/src/features/Favorites/api/mutation.ts:25 |
| mutation | CreateRecommendedPlace | createRecommendedPlace | explorers-earth/src/features/Favorites/api/mutation.ts:34 |
| mutation | DeleteRecommendationList | deleteRecommendationList | explorers-earth/src/features/Favorites/api/mutation.ts:42 |
| mutation | UpdateRecommendationList | updateRecommendationList | explorers-earth/src/features/Favorites/api/mutation.ts:50 |
| mutation | updateRecommendedList | updateRecommendationList | explorers-earth/src/features/Favorites/api/mutation.ts:61 |
| mutation | delete | deleteRecommendedPlace | explorers-earth/src/features/Favorites/api/mutation.ts:80 |
| mutation | update | updateRecommendedPlace | explorers-earth/src/features/Favorites/api/mutation.ts:88 |
| mutation | CreateRecommendedPerson | createRecommendedPlace | explorers-earth/src/features/Favorites/api/mutation.ts:97 |
| mutation | updatePerson | updateRecommendedPlace | explorers-earth/src/features/Favorites/api/mutation.ts:105 |
| mutation | CreateClaimablePlaceProfile | createClaimablePlaceProfile | explorers-earth/src/features/Favorites/api/mutation.ts:114 |
| mutation | UpdateClaimablePlaceProfile | updateClaimablePlaceProfile | explorers-earth/src/features/Favorites/api/mutation.ts:136 |
| query | FindClaimablePlaceProfileByPlaceId | claimablePlaceProfiles | explorers-earth/src/features/Favorites/api/mutation.ts:158 |
| mutation | UpdateAccountVisibility | updateAccount | explorers-earth/src/features/Favorites/api/mutation.ts:179 |
| query | UsersPermissionsUser | usersPermissionsUser | explorers-earth/src/features/Favorites/api/query.ts:3 |
| query | RecommendationLists | recommendationLists | explorers-earth/src/features/Favorites/api/query.ts:14 |
| query | RecommendationCategories | recommendationCategories | explorers-earth/src/features/Favorites/api/query.ts:38 |
| query | RecommendationLists | recommendationList | explorers-earth/src/features/Favorites/api/query.ts:51 |
| query | recommendedplace | recommendedPlace | explorers-earth/src/features/Favorites/api/query.ts:127 |
| query | RecommendedPlaces | recommendedPlaces | explorers-earth/src/features/Favorites/api/query.ts:161 |
| query | AllRecommendedPlaces | recommendationList | explorers-earth/src/features/Favorites/api/query.ts:184 |
| query | LocationWithPeopleForLink | recommendationList | explorers-earth/src/features/Favorites/components/AddLinkedPeoplePage.tsx:19 |
| query | MyAccountForPeopleLink | usersPermissionsUser | explorers-earth/src/features/Favorites/components/AddLinkedPeoplePage.tsx:40 |
| query | LocationWithProductsForLink | recommendationList | explorers-earth/src/features/Favorites/components/AddLinkedProductsPage.tsx:19 |
| query | MyAccountForProductsLink | usersPermissionsUser | explorers-earth/src/features/Favorites/components/AddLinkedProductsPage.tsx:41 |
| query | (anonymous) | claimablePlaceProfiles | explorers-earth/src/features/Favorites/services/claimablePlaceProfileService.ts:47 |
| mutation | CreateGameList | createGameList | explorers-earth/src/features/Games/api/mutation.ts:6 |
| mutation | UpdateGameList | updateGameList | explorers-earth/src/features/Games/api/mutation.ts:40 |
| mutation | DeleteGameList | deleteGameList | explorers-earth/src/features/Games/api/mutation.ts:76 |
| mutation | CreateRecommendedGame | createRecommendedGame | explorers-earth/src/features/Games/api/mutation.ts:87 |
| mutation | UpdateRecommendedGame | updateRecommendedGame | explorers-earth/src/features/Games/api/mutation.ts:159 |
| mutation | DeleteRecommendedGame | deleteRecommendedGame | explorers-earth/src/features/Games/api/mutation.ts:195 |
| mutation | ToggleGamePin | updateRecommendedGame | explorers-earth/src/features/Games/api/mutation.ts:206 |
| query | GameListsByAccount | gameLists | explorers-earth/src/features/Games/api/query.ts:6 |
| query | GamesByList | gameLists | explorers-earth/src/features/Games/api/query.ts:70 |
| query | GameDetails | recommendedGames | explorers-earth/src/features/Games/api/query.ts:145 |
| query | PinnedGames | recommendedGames | explorers-earth/src/features/Games/api/query.ts:194 |
| query | GamesByGenre | recommendedGames | explorers-earth/src/features/Games/api/query.ts:240 |
| query | GameListBySlug | gameLists | explorers-earth/src/features/Games/api/query.ts:274 |
| query | PublicGameData | gameLists, recommendedGames | explorers-earth/src/features/Games/api/query.ts:327 |
| query | GameCategories | gameCategories | explorers-earth/src/features/Games/api/query.ts:399 |
| query | MyAccountForGames | usersPermissionsUser | explorers-earth/src/features/Games/components/dashboard/GamesHome.tsx:28 |
| mutation | CreateGuide | createGuide | explorers-earth/src/features/Guides/api/mutations.ts:3 |
| mutation | UpdateGuide | updateGuide | explorers-earth/src/features/Guides/api/mutations.ts:19 |
| mutation | DeleteGuide | deleteGuide | explorers-earth/src/features/Guides/api/mutations.ts:37 |
| mutation | CreateGuideSection | createGuideSection | explorers-earth/src/features/Guides/api/mutations.ts:45 |
| mutation | UpdateGuideSection | updateGuideSection | explorers-earth/src/features/Guides/api/mutations.ts:65 |
| mutation | DeleteGuideSection | deleteGuideSection | explorers-earth/src/features/Guides/api/mutations.ts:85 |
| query | GetUserAccount | usersPermissionsUser | explorers-earth/src/features/Guides/api/queries.ts:4 |
| query | GetGuides | guides | explorers-earth/src/features/Guides/api/queries.ts:18 |
| query | GetGuideById | guide | explorers-earth/src/features/Guides/api/queries.ts:60 |
| query | GetGuideCategories | guideCategories | explorers-earth/src/features/Guides/api/queries.ts:109 |
| query | GetGuideSections | guideSections | explorers-earth/src/features/Guides/api/queries.ts:118 |
| query | GetPublicGuides | guides | explorers-earth/src/features/Guides/api/queries.ts:145 |
| query | GetPublicGuideById | guide | explorers-earth/src/features/Guides/api/queries.ts:180 |
| query | PlatformTerms | platformTerms | explorers-earth/src/features/LandingPage/api/queries.ts:3 |
| query | Faqs | faqs | explorers-earth/src/features/LandingPage/api/queries.ts:13 |
| mutation | CreateMovieList | createMovieList | explorers-earth/src/features/Movies/api/mutation.ts:6 |
| mutation | UpdateMovieList | updateMovieList | explorers-earth/src/features/Movies/api/mutation.ts:40 |
| mutation | DeleteMovieList | deleteMovieList | explorers-earth/src/features/Movies/api/mutation.ts:76 |
| mutation | CreateRecommendedMovie | createRecommendedMovie | explorers-earth/src/features/Movies/api/mutation.ts:87 |
| mutation | UpdateRecommendedMovie | updateRecommendedMovie | explorers-earth/src/features/Movies/api/mutation.ts:154 |
| mutation | DeleteRecommendedMovie | deleteRecommendedMovie | explorers-earth/src/features/Movies/api/mutation.ts:194 |
| mutation | ToggleMoviePin | updateRecommendedMovie | explorers-earth/src/features/Movies/api/mutation.ts:205 |
| query | MovieListsByAccount | movieLists | explorers-earth/src/features/Movies/api/query.ts:6 |
| query | MoviesByList | movieLists | explorers-earth/src/features/Movies/api/query.ts:66 |
| query | MovieDetails | recommendedMovies | explorers-earth/src/features/Movies/api/query.ts:136 |
| query | PinnedMovies | recommendedMovies | explorers-earth/src/features/Movies/api/query.ts:182 |
| query | MoviesByGenre | recommendedMovies | explorers-earth/src/features/Movies/api/query.ts:217 |
| query | MovieListBySlug | movieLists | explorers-earth/src/features/Movies/api/query.ts:253 |
| query | PublicMovieData | movieLists | explorers-earth/src/features/Movies/api/query.ts:307 |
| query | MovieCategories | movieCategories | explorers-earth/src/features/Movies/api/query.ts:361 |
| query | MyAccountForMovies | usersPermissionsUser | explorers-earth/src/features/Movies/components/dashboard/MoviesHome.tsx:32 |
| mutation | CreatePersonList | createPersonList | explorers-earth/src/features/People/api/mutation.ts:6 |
| mutation | UpdatePersonList | updatePersonList | explorers-earth/src/features/People/api/mutation.ts:42 |
| mutation | DeletePersonList | deletePersonList | explorers-earth/src/features/People/api/mutation.ts:78 |
| mutation | CreateRecommendedPerson | createRecommendedPerson | explorers-earth/src/features/People/api/mutation.ts:89 |
| mutation | UpdateRecommendedPerson | updateRecommendedPerson | explorers-earth/src/features/People/api/mutation.ts:144 |
| mutation | DeleteRecommendedPerson | deleteRecommendedPerson | explorers-earth/src/features/People/api/mutation.ts:200 |
| mutation | TogglePersonPin | updateRecommendedPerson | explorers-earth/src/features/People/api/mutation.ts:211 |
| query | PersonListsByAccount | personLists | explorers-earth/src/features/People/api/query.ts:6 |
| query | PeopleByList | personLists | explorers-earth/src/features/People/api/query.ts:56 |
| query | PinnedPeople | recommendedPeople | explorers-earth/src/features/People/api/query.ts:113 |
| query | PublicPeopleData | personLists | explorers-earth/src/features/People/api/query.ts:153 |
| query | PersonListBySlug | personLists | explorers-earth/src/features/People/api/query.ts:200 |
| query | PersonCategories | peopleCategories | explorers-earth/src/features/People/api/query.ts:249 |
| query | MyAccountForPeople | usersPermissionsUser | explorers-earth/src/features/People/components/dashboard/PeopleHome.tsx:30 |
| mutation | CreateProductList | createProductList | explorers-earth/src/features/Products/api/mutation.ts:6 |
| mutation | UpdateProductList | updateProductList | explorers-earth/src/features/Products/api/mutation.ts:42 |
| mutation | DeleteProductList | deleteProductList | explorers-earth/src/features/Products/api/mutation.ts:78 |
| mutation | CreateRecommendedProduct | createRecommendedProduct | explorers-earth/src/features/Products/api/mutation.ts:89 |
| mutation | UpdateRecommendedProduct | updateRecommendedProduct | explorers-earth/src/features/Products/api/mutation.ts:142 |
| mutation | DeleteRecommendedProduct | deleteRecommendedProduct | explorers-earth/src/features/Products/api/mutation.ts:194 |
| mutation | ToggleProductPin | updateRecommendedProduct | explorers-earth/src/features/Products/api/mutation.ts:205 |
| query | ProductListsByAccount | productLists | explorers-earth/src/features/Products/api/query.ts:6 |
| query | ProductsByList | productLists | explorers-earth/src/features/Products/api/query.ts:58 |
| query | PinnedProducts | recommendedProducts | explorers-earth/src/features/Products/api/query.ts:117 |
| query | PublicProductData | productLists, recommendedProducts | explorers-earth/src/features/Products/api/query.ts:157 |
| query | ProductListBySlug | productLists | explorers-earth/src/features/Products/api/query.ts:221 |
| query | ProductsByCategory | recommendedProducts | explorers-earth/src/features/Products/api/query.ts:272 |
| query | ProductCategories | productCategories | explorers-earth/src/features/Products/api/query.ts:310 |
| query | MyAccountForProducts | usersPermissionsUser | explorers-earth/src/features/Products/components/dashboard/ProductsHome.tsx:30 |
| query | GetDashboardStatus | usersPermissionsUser | explorers-earth/src/features/Profile/api/UserStatus.ts:5 |
| mutation | UpdateAccount | updateAccount | explorers-earth/src/features/Profile/api/mutation.ts:3 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/features/Profile/api/mutation.ts:30 |
| query | UsersPermissionsUser | usersPermissionsUser | explorers-earth/src/features/Profile/api/query.ts:3 |
| mutation | createAccount | createAccount | explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts:169 |
| mutation | UpdateAccount | updateAccount | explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts:181 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts:208 |
| query | PublicCategoryListCounts | recommendationLists, bookLists, movieLists, gameLists, appLists, productLists, personLists, guides | explorers-earth/src/features/PublicHome/api/query.ts:5 |
| query | RecommendationLists | recommendationLists | explorers-earth/src/features/PublicHome/api/query.ts:42 |
| query | RecommendationCategories | recommendationCategories | explorers-earth/src/features/PublicHome/api/query.ts:60 |
| query | RecommendationLists | recommendationList | explorers-earth/src/features/PublicHome/api/query.ts:73 |
| query | user | accounts | explorers-earth/src/features/PublicHome/api/query.ts:88 |
| query | LinkedListsForRecommendation | personLists, productLists | explorers-earth/src/features/PublicHome/api/query.ts:152 |
| query | user | accounts | explorers-earth/src/features/PublicHome/api/query.ts:225 |
| query | RecommendedPlace | recommendedPlace | explorers-earth/src/features/PublicHome/api/query.ts:337 |
| query | Account | accounts | explorers-earth/src/features/PublicHome/api/query.ts:362 |
| query | Account | accounts | explorers-earth/src/features/PublicHome/api/query.ts:383 |
| query | PublicAccountBasic | accounts | explorers-earth/src/features/PublicHome/api/query.ts:407 |
| query | PublicProfileData | accounts | explorers-earth/src/features/PublicHome/api/query.ts:441 |
| query | Account | accounts | explorers-earth/src/features/PublicHome/api/query.ts:478 |
| query | Account | account | explorers-earth/src/features/PublicHome/api/query.ts:513 |
| query | Account | account | explorers-earth/src/features/PublicHome/api/query.ts:521 |
| query | UsersPermissionsUser | usersPermissionsUser | explorers-earth/src/features/Settings/Settings.tsx:47 |
| query | SettingsAccount | usersPermissionsUser | explorers-earth/src/features/Settings/Settings.tsx:55 |
| mutation | update | changePassword | explorers-earth/src/features/Settings/api/mutation.ts:3 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/features/Settings/api/mutation.ts:21 |
| mutation | DeleteExplorerAccount | deleteAccount | explorers-earth/src/features/Settings/api/mutation.ts:34 |
| mutation | DeleteExplorerUser | deleteRecommendationList, deleteUsersPermissionsUser | explorers-earth/src/features/Settings/api/mutation.ts:42 |
| query | Account | accounts | explorers-earth/src/features/Settings/api/mutation.ts:62 |
| mutation | UpdateAccount | updateAccount | explorers-earth/src/features/Settings/api/mutation.ts:82 |
| mutation | UpdateTabVisibility | updateAccount | explorers-earth/src/features/Settings/api/mutation.ts:102 |
| query | UsersPermissionsUser | usersPermissionsUser | explorers-earth/src/features/Settings/api/mutation.ts:122 |
| mutation | AddReasonForLeaving | createReasonForLeaving | explorers-earth/src/features/Settings/api/mutation.ts:134 |
| query | CheckPublishedLists | bookLists, gameLists, appLists, productLists, movieLists, personLists, guides, recommendationLists | explorers-earth/src/features/Settings/api/mutation.ts:143 |
| query | UsersPermissionsUser | usersPermissionsUser | explorers-earth/src/features/Settings/components/BillingTab.tsx:15 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/features/Settings/components/BillingTab.tsx:25 |
| query | CategoryNavigationAccount | usersPermissionsUser | explorers-earth/src/features/navigation/categoryNavigationApi.ts:7 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/pages/Checkout.tsx:26 |
| mutation | createAccount | createAccount | explorers-earth/src/pages/Checkout.tsx:39 |
| query | MusicPageEligibility | usersPermissionsUser | explorers-earth/src/pages/Music.tsx:28 |
| mutation | createAccount | createAccount | explorers-earth/src/pages/OnBoarding.tsx:58 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/pages/OnBoarding.tsx:77 |
| query | CheckAccount | usersPermissionsUser | explorers-earth/src/pages/OnBoarding.tsx:91 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/pages/OnBoarding.tsx:106 |
| mutation | UpdateAccount | updateAccount | explorers-earth/src/pages/OnBoarding.tsx:117 |
| mutation | UpdateUsersPermissionsUser | updateUsersPermissionsUser | explorers-earth/src/pages/SubscriptionPlans.tsx:17 |
| query | CheckUsernameAvailability | accounts | explorers-earth/src/utils/usernameAPI.ts:7 |
| mutation | login | login | tunes/client/src/lib/graphql-mutations.ts:9 |
| mutation | register | register | tunes/client/src/lib/graphql-mutations.ts:25 |
| mutation | forgotPassword | forgotPassword | tunes/client/src/lib/graphql-mutations.ts:41 |
| mutation | resetPassword | resetPassword | tunes/client/src/lib/graphql-mutations.ts:50 |
| query | CheckUsernameAvailability | usersPermissionsUsers | tunes/client/src/lib/graphql-mutations.ts:70 |

## Untagged GraphQL strings and templates

Dynamic templates may generate multiple category-specific documents. Counts are template sites.

| Kind | Name | Dynamic | Source |
|---|---|---|---|
| mutation | CreateFaq | false | tunes/client/src/lib/strapi-mutations.ts:72 |
| mutation | UpdateFaq | false | tunes/client/src/lib/strapi-mutations.ts:87 |
| mutation | DeleteFaq | false | tunes/client/src/lib/strapi-mutations.ts:102 |
| mutation | CreateSubscriptionPlanBase | false | tunes/client/src/lib/strapi-mutations.ts:117 |
| mutation | UpdateSubscriptionPlanBase | false | tunes/client/src/lib/strapi-mutations.ts:131 |
| mutation | DeleteSubscriptionPlanBase | false | tunes/client/src/lib/strapi-mutations.ts:145 |
| mutation | CreateAccount | false | tunes/client/src/lib/strapi-mutations.ts:159 |
| mutation | UpdateAccount | false | tunes/client/src/lib/strapi-mutations.ts:172 |
| mutation | DeleteAccount | false | tunes/client/src/lib/strapi-mutations.ts:185 |
| mutation | CreateUserSubscriptionPlan | false | tunes/client/src/lib/strapi-mutations.ts:198 |
| mutation | UpdateUserSubscriptionPlan | false | tunes/client/src/lib/strapi-mutations.ts:213 |
| mutation | DeleteUserSubscriptionPlan | false | tunes/client/src/lib/strapi-mutations.ts:228 |
| mutation | CreateSongLimit | false | tunes/client/src/lib/strapi-mutations.ts:243 |
| mutation | UpdateSongLimit | false | tunes/client/src/lib/strapi-mutations.ts:256 |
| mutation | DeleteSongLimit | false | tunes/client/src/lib/strapi-mutations.ts:269 |
| query | Faqs | false | tunes/client/src/lib/strapi-queries.ts:102 |
| query | SubscriptionPlanBases | false | tunes/client/src/lib/strapi-queries.ts:117 |
| query | UsersPermissionsUsers | false | tunes/client/src/lib/strapi-queries.ts:136 |
| query | Accounts | false | tunes/client/src/lib/strapi-queries.ts:147 |
| query | UserSubscriptionPlans | false | tunes/client/src/lib/strapi-queries.ts:160 |
| query | SongLimits | false | tunes/client/src/lib/strapi-queries.ts:175 |
| query | Me | false | tunes/client/src/pages/google-auth-redirect.tsx:19 |
| query | PublicCategory | true | tunes/server/publicProfile/strapiPublicProfileGateway.ts:151 |
| query | PublicGuideDocumentDetail | true | tunes/server/publicProfile/strapiPublicProfileGateway.ts:163 |
| query | PublicGuideHeaders | false | tunes/server/publicProfile/strapiPublicProfileGateway.ts:182 |
| query | Public | true | tunes/server/publicProfile/strapiPublicProfileGateway.ts:227 |
| query | PublicAccount | true | tunes/server/publicProfile/strapiPublicProfileGateway.ts:241 |
| query | PublicNavigationCounts | true | tunes/server/publicProfile/strapiPublicProfileGateway.ts:253 |
| query | PublicAccountsForSitemap | false | tunes/server/seo-routes.ts:128 |
| mutation | CreateExplorersAnalyticsEvent | false | tunes/server/services/explorers-analytics-adapters.ts:47 |
| query | ReadExplorersAnalyticsEvents | false | tunes/server/services/explorers-analytics-adapters.ts:55 |
| query | FindExplorersAnalyticsEvent | false | tunes/server/services/explorers-analytics-adapters.ts:81 |
| query | ValidatePublicAnalyticsTarget | true | tunes/server/services/explorers-analytics-adapters.ts:272 |
| query | Query | false | tunes/server/services/strapi-service.ts:128 |
| mutation | Mutation | false | tunes/server/services/strapi-service.ts:168 |
| mutation | UpdateSongLimit | false | tunes/server/services/strapi-service.ts:203 |
| query | MusicIdentityAbsence | false | tunes/server/services/strapiIdentityAbsenceProof.ts:52 |

## HTTP declarations

These require reachability classification in the architecture report; declaration is not evidence of deployment.

| Method | Path | Source |
|---|---|---|
| POST | /api/login | tunes/server/auth.ts:401 |
| POST | /api/register | tunes/server/auth.ts:492 |
| POST | /api/logout | tunes/server/auth.ts:671 |
| GET | /api/check | tunes/server/auth.ts:737 |
| GET | /api/csrf-token | tunes/server/auth.ts:746 |
| GET | env | tunes/server/config/music-startup.ts:115 |
| GET | /health/live | tunes/server/deployment/music-health.ts:43 |
| GET | /health/ready | tunes/server/deployment/music-health.ts:47 |
| GET | /api/music-entry/status | tunes/server/deployment/music-health.ts:70 |
| GET | /health/live | tunes/server/deployment/music-local-health.ts:32 |
| GET | /health/ready | tunes/server/deployment/music-local-health.ts:36 |
| GET | /api/music-entry/status | tunes/server/deployment/music-local-health.ts:72 |
| GET | env | tunes/server/index.ts:20 |
| GET | /health/live | tunes/server/publicProfile/localPublicProfileGatewayApp.ts:28 |
| POST | /api/explorers/analytics/music-account/:accountDocumentId/events | tunes/server/routes/explorersAnalyticsRoutes.ts:189 |
| POST | /api/explorers/analytics/music/:publicSlug/events | tunes/server/routes/explorersAnalyticsRoutes.ts:225 |
| POST | /api/explorers/analytics/events | tunes/server/routes/explorersAnalyticsRoutes.ts:275 |
| GET | /api/explorers/analytics/events | tunes/server/routes/explorersAnalyticsRoutes.ts:322 |
| GET | /api/explorers/v1/profiles/:username | tunes/server/routes/explorersPublicProfileRoutes.ts:24 |
| GET | /api/explorers/v1/profiles/:username/recommendations/:category | tunes/server/routes/explorersPublicProfileRoutes.ts:38 |
| GET | /api/explorers/v1/profiles/:username/recommendations/:category/:slug | tunes/server/routes/explorersPublicProfileRoutes.ts:54 |
| GET | /itunes-api/search | tunes/server/routes/index.ts:280 |
| GET | /api/music/features | tunes/server/routes/musicFeatureRoutes.ts:13 |
| GET | /api/music-fixture/readiness | tunes/server/routes/musicFixtureProbe.ts:23 |
| POST | /api/music/identity/ensure | tunes/server/routes/musicIdentityRoutes.ts:83 |
| POST | /api/music/identity/lifecycle/prepare | tunes/server/routes/musicIdentityRoutes.ts:196 |
| GET | /api/music/identity/lifecycle/status | tunes/server/routes/musicIdentityRoutes.ts:197 |
| POST | /api/music/identity/lifecycle/boundary | tunes/server/routes/musicIdentityRoutes.ts:198 |
| POST | /api/music/identity/lifecycle/cancel | tunes/server/routes/musicIdentityRoutes.ts:199 |
| POST | /api/music/identity/lifecycle/suspend | tunes/server/routes/musicIdentityRoutes.ts:235 |
| POST | /api/music/identity/lifecycle/resume | tunes/server/routes/musicIdentityRoutes.ts:238 |
| GET | /api/music/identity/current | tunes/server/routes/musicIdentityRoutes.ts:244 |
| GET | /api-docs | tunes/server/routes/musicOpenApiRoutes.ts:767 |
| GET | /api/music/public-profile/:accountDocumentId | tunes/server/routes/musicSurfaceRoutes.ts:160 |
| GET | /api/music/public-resource/v1/:publicSlug | tunes/server/routes/musicSurfaceRoutes.ts:185 |
| GET | /api/playlists | tunes/server/routes/musicSurfaceRoutes.ts:208 |
| POST | /api/playlists | tunes/server/routes/musicSurfaceRoutes.ts:212 |
| GET | /api/playlists/:playlistId | tunes/server/routes/musicSurfaceRoutes.ts:228 |
| PATCH | /api/playlists/:playlistId | tunes/server/routes/musicSurfaceRoutes.ts:236 |
| DELETE | /api/playlists/:playlistId | tunes/server/routes/musicSurfaceRoutes.ts:248 |
| POST | /api/playlists/:playlistId/songs | tunes/server/routes/musicSurfaceRoutes.ts:255 |
| DELETE | /api/playlists/:playlistId/songs/:songId | tunes/server/routes/musicSurfaceRoutes.ts:271 |
| PATCH | /api/playlists/:playlistId/reorder | tunes/server/routes/musicSurfaceRoutes.ts:280 |
| PATCH | /api/playlists/:playlistId/visibility | tunes/server/routes/musicSurfaceRoutes.ts:291 |
| GET | /api/playlist/songs | tunes/server/routes/musicSurfaceRoutes.ts:302 |
| POST | /api/music/queue/replace | tunes/server/routes/musicSurfaceRoutes.ts:306 |
| GET | /api/music/dashboard | tunes/server/routes/musicSurfaceRoutes.ts:329 |
| POST | /api/music/queue/append | tunes/server/routes/musicSurfaceRoutes.ts:333 |
| PATCH | /api/music/guest-controls | tunes/server/routes/musicSurfaceRoutes.ts:358 |
| GET | /api/music/guest-controls | tunes/server/routes/musicSurfaceRoutes.ts:366 |
| POST | /api/playlist/songs | tunes/server/routes/musicSurfaceRoutes.ts:374 |
| POST | /api/playlist/currently-playing | tunes/server/routes/musicSurfaceRoutes.ts:382 |
| DELETE | /api/playlist/songs/bulk | tunes/server/routes/musicSurfaceRoutes.ts:417 |
| DELETE | /api/playlist/songs/:songId | tunes/server/routes/musicSurfaceRoutes.ts:426 |
| PATCH | /api/playlist/songs/:songId/position | tunes/server/routes/musicSurfaceRoutes.ts:433 |
| DELETE | /api/playlist/history | tunes/server/routes/musicSurfaceRoutes.ts:447 |
| DELETE | /api/playlist/history/:songId | tunes/server/routes/musicSurfaceRoutes.ts:451 |
| POST | /api/youtube/search | tunes/server/routes/musicSurfaceRoutes.ts:467 |
| POST | /api/youtube/video-from-url | tunes/server/routes/musicSurfaceRoutes.ts:479 |
| POST | /api/music/publication | tunes/server/routes/musicSurfaceRoutes.ts:491 |
| POST | /api/music/paid/import | tunes/server/routes/musicSurfaceRoutes.ts:525 |
| GET | /api/music/entitlement | tunes/server/routes/musicSurfaceRoutes.ts:535 |
| GET | /api/playlist/:guestUrl | tunes/server/routes/musicSurfaceRoutes.ts:551 |
| POST | /api/playlist/:guestUrl/youtube/search | tunes/server/routes/musicSurfaceRoutes.ts:573 |
| POST | /api/playlist/:guestUrl/youtube/video-from-url | tunes/server/routes/musicSurfaceRoutes.ts:587 |
| POST | /api/playlist/:guestUrl/requests | tunes/server/routes/musicSurfaceRoutes.ts:600 |
| ALL | /{*musicRetiredPath} | tunes/server/routes/musicSurfaceRoutes.ts:691 |
| POST | /api/user/request-reactivation | tunes/server/routes/reactivationRoutes.ts:134 |
| GET | /api/user/reactivate | tunes/server/routes/reactivationRoutes.ts:165 |
| GET | /robots.txt | tunes/server/seo-routes.ts:178 |
| GET | /sitemap.xml | tunes/server/seo-routes.ts:195 |
| GET | /api/explorers-sitemap.xml | tunes/server/seo-routes.ts:216 |

## Socket declarations

| Direction | Event | Source |
|---|---|---|
| on | connect | tunes/client/src/hooks/use-websocket.tsx:73 |
| on | disconnect | tunes/client/src/hooks/use-websocket.tsx:79 |
| on | connect_error | tunes/client/src/hooks/use-websocket.tsx:83 |
| emit | player_state | tunes/client/src/hooks/use-websocket.tsx:110 |
| emit | guest_request | tunes/client/src/hooks/use-websocket.tsx:112 |
| emit | music_error | tunes/server/socket/musicSocketServer.ts:167 |
| emit | music_public_change | tunes/server/socket/musicSocketServer.ts:182 |
| emit | music_owner_change | tunes/server/socket/musicSocketServer.ts:196 |
| emit | music_error | tunes/server/socket/musicSocketServer.ts:199 |
| emit | music_error | tunes/server/socket/musicSocketServer.ts:256 |
| on | connection | tunes/server/socket/musicSocketServer.ts:319 |
| emit | connection_status | tunes/server/socket/musicSocketServer.ts:347 |
| on | disconnect | tunes/server/socket/musicSocketServer.ts:348 |
| emit | music_error | tunes/server/socket/musicSocketServer.ts:352 |
| on | player_state | tunes/server/socket/musicSocketServer.ts:373 |
| on | guest_request | tunes/server/socket/musicSocketServer.ts:386 |
| emit | guest_request_status | tunes/server/socket/musicSocketServer.ts:398 |
| emit | music_error | tunes/server/socket/musicSocketServer.ts:403 |

## Files with coupling signals

| File | Signals |
|---|---|
| explorers-earth/src/components/AuthSyncManager.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/components/CircularPlacesModal.tsx | DOCUMENT_ID |
| explorers-earth/src/components/Header.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/components/ProfileSetupAccordion.tsx | STRAPI_REFERENCE, UPLOAD |
| explorers-earth/src/components/ProtectedRoute.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/components/PublicNav.tsx | STRAPI_REFERENCE |
| explorers-earth/src/components/Sidenav.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/components/ui/Carousel.tsx | DOCUMENT_ID |
| explorers-earth/src/components/ui/Dropdown.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Analytics/api/queries.ts | STRAPI_REFERENCE |
| explorers-earth/src/features/Analytics/components/AnalyticsDashboard.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Analytics/components/charts/LocationEngagementChart.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Analytics/components/charts/RecommendedPlacesChart.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/dashboard/AppListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/dashboard/AppTopPicksManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/dashboard/AppsHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/public/AppCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/public/AppTopPicksHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/public/AppTopPicksMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/public/PublicAppList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/components/public/PublicApps.tsx | DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/AppsAndTools/utils/appHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Authentication/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Authentication/api/queries.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Authentication/api/userQueries.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Authentication/components/PlaceProfileCard.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Authentication/hooks/useCurrentUser.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Books/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Books/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Books/components/dashboard/AddBookPage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Books/components/dashboard/BookListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/dashboard/BooksHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Books/components/dashboard/TopReadsManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/BookCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/BookDetailModal.tsx | STRAPI_REFERENCE |
| explorers-earth/src/features/Books/components/public/PublicBookList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/PublicBookSubject.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/PublicBooks.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/TopReadsHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/components/public/TopReadsMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Books/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Books/utils/bookHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/api/mutation.ts | GRAPHQL, STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/AddLinkedPeoplePage.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/AddLinkedProductsPage.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/AddPlaceOverlay.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/AddRecommendation.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/LinksAndQR.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/RecommendForm.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/Recommendations.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/components/TopPlacesByCategory.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/hooks/useAddRecommendation.ts | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/hooks/useCreateLocation.ts | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Favorites/hooks/useMenuItems.ts | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/hooks/useRecommedationFields.ts | DOCUMENT_ID |
| explorers-earth/src/features/Favorites/services/claimablePlaceProfileService.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Games/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Games/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Games/components/dashboard/AddGamePage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Games/components/dashboard/GameListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/components/dashboard/GamesHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Games/components/dashboard/TopGamesManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/GameCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/GameDetailModal.tsx | UPLOAD |
| explorers-earth/src/features/Games/components/public/PublicGames.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/PublicGamesGenre.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/PublicGamesList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/TopGamesHero.tsx | UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Games/components/public/TopGamesMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Games/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Games/utils/gameHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Guides/GuidesPage.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/api/mutations.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Guides/api/queries.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/CreateGuidePage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/CreateGuideStep2.tsx | STRAPI_REFERENCE |
| explorers-earth/src/features/Guides/components/GuideCard.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/BudgetTable.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/BudgetTimeline.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/EditGeneralTipsModal.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/EditJourneyRouteModal.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/EditStayModal.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/EditTipModal.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/GuideHeader.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/ItineraryView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/SectionCard.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/SectionFormModal.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/StayTimeline.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/TipsTimeline.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideDetails/TransportationTimeline.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/GuideSectionForm.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/Shared/DescriptionRenderer.tsx | STRAPI_REFERENCE |
| explorers-earth/src/features/Guides/components/TopPicksHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/components/TopPicksMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/guideService.ts | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Guides/pages/GuideDetailsPage.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Guides/pages/GuideSectionFormPage.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Guides/services/activityPhotoService.ts | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Guides/services/aiSectionGenerationService.ts | STRAPI_REFERENCE, UPLOAD |
| explorers-earth/src/features/Guides/types/guideSectionTypes.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Guides/types/index.ts | DOCUMENT_ID |
| explorers-earth/src/features/LandingPage/api/queries.ts | GRAPHQL |
| explorers-earth/src/features/Movies/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Movies/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/dashboard/AddMoviePage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/dashboard/MovieListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/dashboard/MoviesHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/dashboard/TopPicksManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/MovieCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/MovieDetailModal.tsx | STRAPI_REFERENCE |
| explorers-earth/src/features/Movies/components/public/PublicMovieGenre.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/PublicMovieList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/PublicMovies.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/TopPicksHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/components/public/TopPicksMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Movies/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Movies/utils/movieHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/People/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/People/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/People/components/dashboard/AddPersonPage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/People/components/dashboard/PeopleHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/People/components/dashboard/PersonListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/dashboard/PersonTopPicksManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PersonCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PersonTopPicksHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PersonTopPicksMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PublicPeople.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PublicPersonList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/components/public/PublicPersonSector.tsx | DOCUMENT_ID |
| explorers-earth/src/features/People/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/People/utils/personHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Products/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Products/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Products/components/dashboard/ProductListView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/dashboard/ProductTopPicksManager.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/dashboard/ProductsHome.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Products/components/public/ProductCarouselRow.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/public/ProductTopPicksHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/public/ProductTopPicksMobileHero.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/public/PublicProductList.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/components/public/PublicProducts.tsx | DOCUMENT_ID |
| explorers-earth/src/features/Products/types/index.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Products/utils/productHelpers.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/Profile/api/UserStatus.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Profile/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Profile/api/query.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Profile/components/FeedFields.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/api/publicProfilePagination.ts | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/api/query.ts | GRAPHQL, STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/MapView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PlaceDetails/PersonOverview.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PlaceDetails/PlaceDetails.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PlaceDetails/PlaceOverview.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PlaceMapView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/ProfileRecommendationsTab.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideDetailPage.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideModal.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideViews/DayNavigationView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideViews/PublicGuideJourneyView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideViews/PublicGuideStayView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideViews/PublicGuideTipsView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuideViews/PublicGuideTransportView.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicGuides.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicHome.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicProfile.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/PublicProfileThemeProvider.tsx | DOCUMENT_ID |
| explorers-earth/src/features/PublicHome/components/publicPlaceMedia.ts | STRAPI_REFERENCE, UPLOAD |
| explorers-earth/src/features/Settings/Settings.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Settings/api/mutation.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Settings/components/BillingTab.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/features/Settings/components/ProfileAccountSettings.tsx | DOCUMENT_ID |
| explorers-earth/src/features/music/MusicPublishProvider.tsx | STRAPI_REFERENCE |
| explorers-earth/src/features/music/PublicMusicAvailabilityProvider.tsx | DOCUMENT_ID |
| explorers-earth/src/features/music/musicApi.ts | STRAPI_REFERENCE |
| explorers-earth/src/features/music/musicIdentityCoordinator.ts | DOCUMENT_ID |
| explorers-earth/src/features/navigation/CategoryNavigationProvider.tsx | DOCUMENT_ID |
| explorers-earth/src/features/navigation/categoryNavigationApi.ts | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/hooks/useAIGuideQuota.ts | DOCUMENT_ID |
| explorers-earth/src/hooks/useMediaViewer.ts | DOCUMENT_ID |
| explorers-earth/src/lib/apolloCache.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/lib/localTunesApiClient.ts | STRAPI_REFERENCE |
| explorers-earth/src/main.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/pages/Checkout.tsx | GRAPHQL, STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/pages/ClaimAccount.tsx | STRAPI_REFERENCE, UPLOAD |
| explorers-earth/src/pages/EmailVerification.tsx | STRAPI_REFERENCE |
| explorers-earth/src/pages/Favorites.tsx | DOCUMENT_ID |
| explorers-earth/src/pages/GoogleAuthRedirect.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/pages/Home.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/pages/Login.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/pages/Music.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/pages/OnBoarding.tsx | GRAPHQL, STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/pages/Profile.tsx | STRAPI_REFERENCE, UPLOAD, DOCUMENT_ID |
| explorers-earth/src/pages/RecommendationsHub.tsx | DOCUMENT_ID |
| explorers-earth/src/pages/Register.tsx | STRAPI_REFERENCE |
| explorers-earth/src/pages/SubscriptionPlans.tsx | GRAPHQL, DOCUMENT_ID |
| explorers-earth/src/pages/public/ProfileMusic.tsx | DOCUMENT_ID |
| explorers-earth/src/services/aiGuideService.ts | STRAPI_REFERENCE |
| explorers-earth/src/services/geminiService.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/services/googleBooksService.ts | STRAPI_REFERENCE |
| explorers-earth/src/services/igdbService.ts | UPLOAD |
| explorers-earth/src/services/paymentService.ts | STRAPI_REFERENCE |
| explorers-earth/src/services/requestTrackingService.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/services/subscriptionService.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/services/useAccountLifecycleIdentity.ts | DOCUMENT_ID |
| explorers-earth/src/store/store.ts | DOCUMENT_ID |
| explorers-earth/src/store/useCityStore.ts | DOCUMENT_ID |
| explorers-earth/src/utils/categoryMapper.ts | DOCUMENT_ID |
| explorers-earth/src/utils/fileValidation.ts | STRAPI_REFERENCE |
| explorers-earth/src/utils/publicGuideSlug.ts | DOCUMENT_ID |
| explorers-earth/src/utils/rating.ts | STRAPI_REFERENCE |
| explorers-earth/src/utils/strapiBlocksConverter.ts | STRAPI_REFERENCE |
| explorers-earth/src/utils/uploadPathGenerator.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| explorers-earth/src/utils/usernameAPI.ts | GRAPHQL, DOCUMENT_ID |
| tunes/client/src/components/new-header.tsx | STRAPI_REFERENCE |
| tunes/client/src/components/search-songs.tsx | STRAPI_REFERENCE |
| tunes/client/src/hooks/use-auth-compat.tsx | STRAPI_REFERENCE |
| tunes/client/src/hooks/use-auth.tsx | STRAPI_REFERENCE |
| tunes/client/src/hooks/use-neon-user.ts | STRAPI_REFERENCE |
| tunes/client/src/hooks/use-strapi-auth.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/lib/apollo-client.ts | STRAPI_REFERENCE |
| tunes/client/src/lib/csrf.ts | UPLOAD |
| tunes/client/src/lib/google-auth.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/lib/graphql-mutations.ts | GRAPHQL, STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/lib/queryClient.ts | STRAPI_REFERENCE |
| tunes/client/src/lib/strapi-client.ts | STRAPI_REFERENCE |
| tunes/client/src/lib/strapi-mutations.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/lib/strapi-queries.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/pages/admin/tabs/ApiTokensTab.tsx | UPLOAD |
| tunes/client/src/pages/admin/tabs/EmailTab.tsx | UPLOAD |
| tunes/client/src/pages/admin/tabs/SystemTab.tsx | UPLOAD |
| tunes/client/src/pages/admin/tabs/TeamTab.tsx | UPLOAD |
| tunes/client/src/pages/dashboard-page.tsx | STRAPI_REFERENCE |
| tunes/client/src/pages/google-auth-redirect.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/pages/google-callback-page.tsx | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/client/src/pages/new-auth-page.tsx | STRAPI_REFERENCE |
| tunes/client/src/pages/playlist-page.tsx | STRAPI_REFERENCE |
| tunes/client/src/pages/tabs/ApiTokensTab.tsx | UPLOAD |
| tunes/client/src/pages/tabs/EmailTab.tsx | UPLOAD |
| tunes/client/src/pages/tabs/SystemTab.tsx | UPLOAD |
| tunes/client/src/pages/tabs/TeamTab.tsx | UPLOAD |
| tunes/client/src/pages/user-detail-page.tsx | UPLOAD |
| tunes/client/src/stores/authStore.ts | DOCUMENT_ID |
| tunes/client/src/types/env.d.ts | STRAPI_REFERENCE |
| tunes/server/app.ts | STRAPI_REFERENCE |
| tunes/server/auth.ts | STRAPI_REFERENCE |
| tunes/server/config/local-public-profile-gateway.ts | STRAPI_REFERENCE |
| tunes/server/config/music-environment.ts | STRAPI_REFERENCE |
| tunes/server/config/music-identity-config.ts | STRAPI_REFERENCE |
| tunes/server/config/music-local-profile.ts | STRAPI_REFERENCE |
| tunes/server/config/music-reconciliation-config.ts | STRAPI_REFERENCE |
| tunes/server/jwt-auth-middleware.ts | STRAPI_REFERENCE |
| tunes/server/middleware/musicPrincipal.ts | STRAPI_REFERENCE |
| tunes/server/policies/musicRetirementPolicy.ts | STRAPI_REFERENCE |
| tunes/server/policies/musicSurfacePolicy.ts | STRAPI_REFERENCE |
| tunes/server/publicProfile/publicProfileContract.ts | STRAPI_REFERENCE |
| tunes/server/publicProfile/strapiPublicProfileGateway.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/repositories/musicDomainRepository.ts | STRAPI_REFERENCE |
| tunes/server/repositories/musicIdentityRepository.ts | STRAPI_REFERENCE |
| tunes/server/repositories/reconciliationRepository.ts | STRAPI_REFERENCE |
| tunes/server/routes/index.ts | STRAPI_REFERENCE |
| tunes/server/routes/musicFixtureProbe.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/routes/musicIdentityRoutes.ts | STRAPI_REFERENCE |
| tunes/server/routes/musicSurfaceRoutes.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/routes/reactivationRoutes.ts | STRAPI_REFERENCE |
| tunes/server/routes/strapiRoutes.ts | STRAPI_REFERENCE |
| tunes/server/security-containment.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/seo-routes.ts | STRAPI_REFERENCE |
| tunes/server/services/explorers-analytics-adapters.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/explorers-analytics-composition.ts | STRAPI_REFERENCE |
| tunes/server/services/explorers-analytics-receipts.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/explorers-analytics-service.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/musicLifecycleService.ts | STRAPI_REFERENCE |
| tunes/server/services/musicProjectionService.ts | STRAPI_REFERENCE |
| tunes/server/services/musicReconciler.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/musicReconciliationSuspensionListener.ts | STRAPI_REFERENCE |
| tunes/server/services/musicTokenService.ts | STRAPI_REFERENCE |
| tunes/server/services/reactivation-service.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/strapi-service.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/strapiIdentityAbsenceProof.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/strapiIdentityGateway.ts | STRAPI_REFERENCE, DOCUMENT_ID |
| tunes/server/services/youtubeReadService.ts | STRAPI_REFERENCE |
| tunes/server/startup/explorers-analytics-migration.ts | STRAPI_REFERENCE |
| tunes/server/storage.ts | STRAPI_REFERENCE |
| tunes/shared/musicError.ts | STRAPI_REFERENCE |
| tunes/shared/schema.ts | STRAPI_REFERENCE |
