import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import {
  MapPin, Music, Film, BookOpen, Gamepad2, Compass,
  Smartphone, ShoppingBag, Users
} from "lucide-react";
import { toUrlSlug } from "../../../utils/formatAddress";
import PublicPlaceCard from "./PublicPlaceCard";

type CategoryKey = "places" | "music" | "movies" | "books" | "games" | "guides" | "apps" | "products" | "people";

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<any>;
  visibilityField: string;
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    key: "places",  
    label: "Places",        
    icon: MapPin, 
    visibilityField: "public_recommendations",
    color: "emerald",
  },
  { 
    key: "music",   
    label: "Music",         
    icon: Music, 
    visibilityField: "public_music",
    color: "purple",
  },
  { 
    key: "movies",  
    label: "Movies & Shows", 
    icon: Film, 
    visibilityField: "public_movie",
    color: "blue",
  },
  { 
    key: "books",   
    label: "Books",         
    icon: BookOpen, 
    visibilityField: "public_books",
    color: "orange",
  },
  { 
    key: "games",   
    label: "Games",         
    icon: Gamepad2, 
    visibilityField: "public_games",
    color: "pink",
  },
  { 
    key: "guides",   
    label: "Guides",         
    icon: Compass, 
    visibilityField: "public_guides",
    color: "cyan",
  },
  { 
    key: "apps",   
    label: "Apps & Tools",         
    icon: Smartphone, 
    visibilityField: "public_apps",
    color: "violet",
  },
  { 
    key: "products",   
    label: "Products",         
    icon: ShoppingBag, 
    visibilityField: "public_products",
    color: "rose",
  },
  { 
    key: "people",   
    label: "People",         
    icon: Users, 
    visibilityField: "public_people",
    color: "indigo",
  },
];

const getHexColor = (color: string) => {
  switch (color) {
    case "emerald": return "#10b981";
    case "purple":  return "#a855f7";
    case "blue":    return "#3b82f6";
    case "orange":  return "#f97316";
    case "pink":    return "#ec4899";
    case "cyan":    return "#06b6d4";
    case "violet":  return "#8b5cf6";
    case "rose":    return "#f43f5e";
    case "indigo":  return "#6366f1";
    default:        return "#ffffff";
  }
};

const resolveCoverUrl = (
  path: string | null | undefined,
  type?: "movie" | "book" | "game" | "place" | "guide" | "music" | "app" | "product" | "person"
): string | undefined => {
  if (!path || path === "null" || path === "undefined") return undefined;

  // If it's already a full URL, return it
  if (path.startsWith("http")) return path;

  // If it starts with /uploads/ (local Strapi upload), prepend backend URL
  if (path.startsWith("/uploads/")) {
    const backendUrl = import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
    return `${backendUrl}${path}`;
  }

  // If it's a movie poster from TMDB (starts with / but not /uploads/)
  if (type === "movie") {
    return `https://image.tmdb.org/t/p/w185${path.startsWith("/") ? path : `/${path}`}`;
  }

  // If it starts with / but not /uploads/ for other types, prepend backend URL anyway
  if (path.startsWith("/")) {
    const backendUrl = import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
    return `${backendUrl}${path}`;
  }

  return path;
};

const formatCount = (count: number, singular: string, plural: string) => {
  return `${count} ${count === 1 ? singular : plural}`;
};

const GET_PLACES_LISTS = gql`
  query GetPlacesLists($accountDocumentId: ID!) {
    recommendationLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      List_Name_Details
      recommendationCount: recommended_places(pagination: { limit: 500 }) {
        documentId
      }
      recommended_places(pagination: { limit: 4 }) {
        documentId
        media_details
        Media {
          url
        }
        Place_Details
      }
    }
  }
`;

const GET_MOVIES_LISTS = gql`
  query GetMoviesLists($accountDocumentId: ID!) {
    movieLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      cover_image {
        url
      }
      recommendationCount: recommended_movies(pagination: { limit: 500 }) {
        documentId
      }
      recommended_movies(pagination: { limit: 4 }) {
        documentId
        poster_path
      }
    }
  }
`;

const GET_BOOKS_LISTS = gql`
  query GetBooksLists($accountDocumentId: ID!) {
    bookLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      visibility
      cover_image {
        url
      }
      recommendationCount: recommended_books(pagination: { limit: 500 }) {
        documentId
      }
      recommended_books(pagination: { limit: 4 }) {
        documentId
        cover_url
      }
    }
  }
`;

const GET_GAMES_LISTS = gql`
  query GetGamesLists($accountDocumentId: ID!) {
    gameLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      cover_image {
        url
      }
      recommendationCount: recommended_games(pagination: { limit: 500 }) {
        documentId
      }
      recommended_games(pagination: { limit: 4 }) {
        documentId
        cover_url
        media_details
      }
    }
  }
`;

const GET_APPS_LISTS = gql`
  query GetAppsLists($accountDocumentId: ID!) {
    appLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      cover_image {
        url
      }
      recommendationCount: recommended_apps(pagination: { limit: 500 }) {
        documentId
      }
      recommended_apps(pagination: { limit: 4 }) {
        documentId
        logo_url
      }
    }
  }
`;

const GET_PRODUCTS_LISTS = gql`
  query GetProductsLists($accountDocumentId: ID!) {
    productLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      cover_image {
        url
      }
      recommendationCount: recommended_products(pagination: { limit: 500 }) {
        documentId
      }
      recommended_products(pagination: { limit: 4 }) {
        documentId
        logo_url
        images
      }
    }
  }
`;

const GET_PEOPLE_LISTS = gql`
  query GetPeopleLists($accountDocumentId: ID!) {
    personLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      recommendationCount: recommended_people(pagination: { limit: 500 }) {
        documentId
      }
      recommended_people(pagination: { limit: 4 }) {
        documentId
        avatar_path
        media_details
      }
    }
  }
`;

const GET_GUIDES_LISTS = gql`
  query GetGuidesLists($accountDocumentId: ID!) {
    guides(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      Title
      slug
      Visibility
      Guide_Media {
        url
      }
    }
  }
`;

interface ProfileRecommendationsTabProps {
  accountData: {
    documentId?: string;
    public_recommendations?: string;
    public_music?: string;
    public_movie?: string;
    public_books?: string;
    public_games?: string;
    public_guides?: string;
    public_apps?: string;
    public_products?: string;
    public_people?: string;
  };
  username: string;
}

interface ListCardData {
  id: string;
  title: string;
  image?: string | null;
  previewImages?: string[];
  subtitle?: string;
  onClick: () => void;
}

const CategorySection = ({
  cat,
  lists,
  username,
}: {
  cat: CategoryConfig;
  lists: ListCardData[];
  username: string;
}) => {
  const navigate = useNavigate();
  const IconComponent = cat.icon;

  if (!lists || lists.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-0.5 max-w-[75%]">
          <h2
            onClick={() => navigate(`/${username}/${cat.key}`)}
            className="text-lg font-black text-white cursor-pointer hover:text-blue-500 transition-colors duration-200 flex items-center gap-2 font-poppins"
          >
            <IconComponent className="w-[20px] h-[20px] shrink-0" style={{ color: getHexColor(cat.color) }} />
            <span className="tracking-wide font-black text-[1.125rem]">{cat.label}</span>
          </h2>
        </div>
        <button
          onClick={() => navigate(`/${username}/${cat.key}`)}
          className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-0.5 border-none bg-transparent cursor-pointer"
        >
          See All ➔
        </button>
      </div>

      {/* Horizontal Cards Scrollable list */}
      <div
        className="flex gap-4 overflow-x-auto pt-2 pb-4 px-1 -mt-2 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {lists.map((list) => (
          <PublicPlaceCard
            key={list.id}
            title={list.title}
            image={list.image}
            previewImages={list.previewImages}
            subtitle={list.subtitle}
            onClickhandler={list.onClick}
          />
        ))}
      </div>
    </div>
  );
};

const ProfileRecommendationsTab = ({ accountData, username }: ProfileRecommendationsTabProps) => {
  const navigate = useNavigate();

  // Determine visibility states for each category
  const placesEnabled = useMemo(() => {
    const value = accountData?.public_recommendations;
    return value === "Yes" || value === undefined || value === null;
  }, [accountData]);

  const moviesEnabled = accountData?.public_movie === "Yes";
  const booksEnabled = accountData?.public_books === "Yes";
  const gamesEnabled = accountData?.public_games === "Yes";
  const guidesEnabled = accountData?.public_guides === "Yes";
  const appsEnabled = accountData?.public_apps === "Yes";
  const productsEnabled = accountData?.public_products === "Yes";
  const peopleEnabled = accountData?.public_people === "Yes";

  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      const field = cat.visibilityField as keyof typeof accountData;
      const value = accountData[field];
      if (cat.key === "places") {
        return value === "Yes" || value === undefined || value === null;
      }
      return value === "Yes";
    });
  }, [accountData]);

  // Run 8 resilient queries independently, skipping if category is disabled or no documentId
  const { data: placesData, loading: placesLoading } = useQuery(GET_PLACES_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !placesEnabled,
    errorPolicy: "all",
  });

  const { data: moviesData, loading: moviesLoading } = useQuery(GET_MOVIES_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !moviesEnabled,
    errorPolicy: "all",
  });

  const { data: booksData, loading: booksLoading } = useQuery(GET_BOOKS_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !booksEnabled,
    errorPolicy: "all",
  });

  const { data: gamesData, loading: gamesLoading } = useQuery(GET_GAMES_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !gamesEnabled,
    errorPolicy: "all",
  });

  const { data: appsData, loading: appsLoading } = useQuery(GET_APPS_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !appsEnabled,
    errorPolicy: "all",
  });

  const { data: productsData, loading: productsLoading } = useQuery(GET_PRODUCTS_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !productsEnabled,
    errorPolicy: "all",
  });

  const { data: peopleData, loading: peopleLoading } = useQuery(GET_PEOPLE_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !peopleEnabled,
    errorPolicy: "all",
  });

  const { data: guidesData, loading: guidesLoading } = useQuery(GET_GUIDES_LISTS, {
    variables: { accountDocumentId: accountData?.documentId },
    skip: !accountData?.documentId || !guidesEnabled,
    errorPolicy: "all",
  });

  const isLoading = 
    (placesEnabled && placesLoading) ||
    (moviesEnabled && moviesLoading) ||
    (booksEnabled && booksLoading) ||
    (gamesEnabled && gamesLoading) ||
    (appsEnabled && appsLoading) ||
    (productsEnabled && productsLoading) ||
    (peopleEnabled && peopleLoading) ||
    (guidesEnabled && guidesLoading);

  // Map category data into lists safely
  const categoriesWithLists = useMemo(() => {
    const result: Record<CategoryKey, ListCardData[]> = {
      places: [],
      music: [],
      movies: [],
      books: [],
      games: [],
      guides: [],
      apps: [],
      products: [],
      people: [],
    };

    // 1. Places Lists
    if (placesData?.recommendationLists) {
      result.places = placesData.recommendationLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          let coverImg = null;
          if (list.List_Name_Details) {
            try {
              const details = typeof list.List_Name_Details === "string"
                ? JSON.parse(list.List_Name_Details)
                : list.List_Name_Details;
              if (details?.thumbnail) {
                coverImg = details.thumbnail;
              }
            } catch {
              // Ignore JSON parse error
            }
          }
          const previews = (list.recommended_places || [])
            .map((place: any) => place.media_details?.thumbnail?.url || place.Media?.[0]?.url || place.Place_Details?.Photos?.[0] || "")
            .map((url: string) => resolveCoverUrl(url, "place") || "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(coverImg, "place"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Place", "Places"),
            onClick: () => navigate(`/${username}/places/${toUrlSlug(list.List_Name || "")}`),
          };
        });
    }

    // 3. Movies Lists
    if (moviesData?.movieLists) {
      result.movies = moviesData.movieLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_movies || [])
            .map((movie: any) => movie.poster_path ? resolveCoverUrl(movie.poster_path, "movie") : "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(list.cover_image?.url, "movie"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Movie", "Movies"),
            onClick: () => navigate(`/${username}/movies/${list.slug}`),
          };
        });
    }

    // 4. Books Lists
    if (booksData?.bookLists) {
      result.books = booksData.bookLists
        .filter((list: any) => list.visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_books || [])
            .map((book: any) => book.cover_url ? resolveCoverUrl(book.cover_url, "book") : "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(list.cover_image?.url, "book"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Book", "Books"),
            onClick: () => navigate(`/${username}/books/${list.slug}`),
          };
        });
    }

    // 5. Games Lists
    if (gamesData?.gameLists) {
      result.games = gamesData.gameLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_games || [])
            .map((game: any) => game.cover_url || game.media_details?.thumbnail?.url ? resolveCoverUrl(game.cover_url || game.media_details?.thumbnail?.url, "game") : "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(list.cover_image?.url, "game"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Game", "Games"),
            onClick: () => navigate(`/${username}/games/${list.slug}`),
          };
        });
    }

    // 6. Guides Lists
    if (guidesData?.guides) {
      result.guides = guidesData.guides
        .filter((guide: any) => guide.Visibility === true)
        .map((guide: any) => {
          return {
            id: guide.documentId,
            title: guide.Title || "",
            image: resolveCoverUrl(guide.Guide_Media?.[0]?.url, "guide"),
            previewImages: [],
            onClick: () => navigate(`/${username}/guides/${guide.slug || toUrlSlug(guide.Title) || guide.documentId}`),
          };
        });
    }

    // 7. Apps Lists
    if (appsData?.appLists) {
      result.apps = appsData.appLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_apps || [])
            .map((app: any) => app.logo_url ? resolveCoverUrl(app.logo_url, "app") : "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(list.cover_image?.url, "app"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "App", "Apps"),
            onClick: () => navigate(`/${username}/apps/${list.slug}`),
          };
        });
    }

    // 8. Products Lists
    if (productsData?.productLists) {
      result.products = productsData.productLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_products || [])
            .map((prod: any) => {
              let firstImg = null;
              if (prod.images) {
                try {
                  const parsed = typeof prod.images === "string" ? JSON.parse(prod.images) : prod.images;
                  firstImg = Array.isArray(parsed) ? parsed[0] : parsed;
                } catch {
                  // Ignore JSON parse error
                }
              }
              return firstImg || prod.logo_url ? resolveCoverUrl(firstImg || prod.logo_url, "product") : "";
            })
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: resolveCoverUrl(list.cover_image?.url, "product"),
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Product", "Products"),
            onClick: () => navigate(`/${username}/products/${list.slug}`),
          };
        });
    }

    // 9. People Lists
    if (peopleData?.personLists) {
      result.people = peopleData.personLists
        .filter((list: any) => list.Visibility === true)
        .map((list: any) => {
          const previews = (list.recommended_people || [])
            .map((person: any) => person.avatar_path || person.media_details?.thumbnail?.url ? resolveCoverUrl(person.avatar_path || person.media_details?.thumbnail?.url, "person") : "")
            .filter((url: string) => !!url);

          return {
            id: list.documentId,
            title: list.List_Name || "",
            image: null,
            previewImages: previews,
            subtitle: formatCount(list.recommendationCount?.length || 0, "Person", "People"),
            onClick: () => navigate(`/${username}/people/${list.slug}`),
          };
        });
    }

    return result;
  }, [
    placesData,
    moviesData,
    booksData,
    gamesData,
    guidesData,
    appsData,
    productsData,
    peopleData,
    username,
    navigate
  ]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="pt-2 pb-12 flex flex-col gap-6">
        {visibleCategories.map(cat => {
          const IconComponent = cat.icon;
          return (
            <div key={cat.key} className="flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-0.5 max-w-[75%]">
                  <h2 className="text-base font-extrabold text-white/50 flex items-center gap-1.5 font-poppins">
                    <IconComponent className="w-4 h-4 shrink-0 text-white/20" />
                    <span className="tracking-wide text-xs">{cat.label}</span>
                  </h2>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pt-2 pb-4 px-1 -mt-2 scrollbar-hide">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-[135px] h-[155px] md:w-[155px] md:h-[180px] rounded-[16px] bg-white/5 skeleton-shimmer flex-shrink-0" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Filter out any categories that have no visible lists to avoid empty rows
  const categoriesToShow = visibleCategories.filter(cat => {
    const list = categoriesWithLists[cat.key];
    return list && list.length > 0;
  });

  if (categoriesToShow.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/30" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <p className="text-white/40 font-medium">No recommendations visible</p>
        <p className="text-white/25 text-sm mt-1">The user hasn't enabled any recommendation categories or created any lists yet.</p>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-12 flex flex-col gap-6">
      {categoriesToShow.map(cat => (
        <CategorySection
          key={cat.key}
          cat={cat}
          lists={categoriesWithLists[cat.key]}
          username={username}
        />
      ))}
    </div>
  );
};

export default ProfileRecommendationsTab;
