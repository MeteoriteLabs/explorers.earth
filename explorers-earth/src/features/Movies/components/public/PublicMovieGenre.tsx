import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { ArrowLeft } from "lucide-react";
import type { RecommendedMovie } from "../../types";
import { slugToGenreName, getGenreNames } from "../../utils/movieHelpers";
import MoviePosterCard from "./MoviePosterCard";
import MovieDetailModal from "./MovieDetailModal";
import MoviePosterSkeleton from "./MoviePosterSkeleton";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameForGenre($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      accounts {
        documentId
      }
    }
  }
`;

const PUBLIC_MOVIES_ALL = gql`
  query PublicMoviesAll($accountDocumentId: ID!) {
    movieLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    ) {
      recommended_movies {
        documentId
        tmdb_id
        media_type
        title
        poster_path
        backdrop_path
        year
        genres
        tmdb_rating
        overview
        watch_providers
        user_recommendation_note
        is_pinned
        pin_order
        Media { url }
        movie_list { documentId List_Name slug }
        movie_categories { documentId genre_name }
        director
        runtime
        season_count
      }
    }
  }
`;

const PublicMovieGenre = () => {
  const { username, genreSlug } = useParams<{ username: string; genreSlug: string }>();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const genreName = slugToGenreName(genreSlug ?? "");

  const { data: userLookup, loading: userLoading } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });
  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;

  const { data: moviesData, loading: moviesLoading } = useQuery(PUBLIC_MOVIES_ALL, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
  });

  const loading = userLoading || moviesLoading;

  const allMovies: RecommendedMovie[] = useMemo(() => {
    return (moviesData?.movieLists ?? []).flatMap((l: any) => l.recommended_movies ?? []);
  }, [moviesData]);

  // Filter by genre name (case-insensitive)
  const filteredMovies = useMemo(() => {
    return allMovies.filter(movie => {
      const names = getGenreNames(movie.genres).map(g => g.toLowerCase());
      return names.includes(genreName.toLowerCase());
    });
  }, [allMovies, genreName]);

  const handleMovieClick = (movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <Link
          to={`/${username}/movies`}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> {username}'s Movies
        </Link>

        {loading ? (
          <div className="h-7 w-36 bg-white/5 animate-pulse rounded mb-2" />
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-white">{genreName}</h1>
            <p className="text-white/30 text-xs mt-2">
              {filteredMovies.length} movie{filteredMovies.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {loading ? (
            <MoviePosterSkeleton count={12} />
          ) : filteredMovies.length === 0 ? (
            <p className="col-span-full text-white/40 text-sm py-8 text-center">
              No movies found in this genre.
            </p>
          ) : (
            filteredMovies.map(movie => (
              <MoviePosterCard
                key={movie.documentId}
                movie={movie}
                onClick={handleMovieClick}
                size="sm"
              />
            ))
          )}
        </div>
      </div>

      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
    </div>
  );
};

export default PublicMovieGenre;
