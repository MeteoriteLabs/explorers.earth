import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Users, Share2, ArrowLeft } from "lucide-react";
import { PEOPLE_BY_SECTOR } from "../../api/query";
import {
  deduplicatePeople,
  buildImageUrl,
  slugToCategoryName,
} from "../../utils/personHelpers";
import PlatformIcon from "../PlatformIcon";
import type { RecommendedPerson } from "../../types";
import PersonDetailModal from "./PersonDetailModal";
import { toast } from "sonner";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { resolvePublicChildState } from "../../../../routes/resolvePublicChildState";
import {
  mergePublicConnectionPage,
  usePublicConnectionPagination,
} from "../../../../hooks/usePublicConnectionPagination";
import { PublicConnectionPaginationControl } from "../../../../components/PublicConnectionPaginationControl";

const PublicPersonSector = () => {
  const { username, sectorSlug } = useParams<{ username: string; sectorSlug: string }>();
  const navigate = useNavigate();
  const sectorName = slugToCategoryName(sectorSlug ?? "");

  const [selectedPerson, setSelectedPerson] = useState<RecommendedPerson | null>(null);

  const account = usePublicProfileBootstrapAccount();
  const accountDocumentId = account.documentId;
  const creatorName = account.Account_Name || username;

  const { data, loading, error, refetch, fetchMore } = useQuery(PEOPLE_BY_SECTOR, {
    variables: {
      accountDocumentId,
      sectorName,
      pagination: { page: 1, pageSize: 200 },
    },
    skip: !accountDocumentId || !sectorSlug,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const sector = data?.peopleCategories?.[0];
  const sectorPeople = deduplicatePeople<RecommendedPerson>(
    data?.recommendedPeople_connection?.nodes ?? [],
  );
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(accountDocumentId && sectorSlug),
    resourceKind: "child",
    entityExists: Boolean(sector),
    empty: Boolean(sector) && sectorPeople.length === 0,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: childState === "empty",
  });

  const loadPage = useCallback(async (page: number) => {
    await fetchMore({
      variables: { pagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!previous.recommendedPeople_connection || !fetchMoreResult?.recommendedPeople_connection) return previous;
        return {
          ...previous,
          recommendedPeople_connection: mergePublicConnectionPage(
            previous.recommendedPeople_connection,
            fetchMoreResult.recommendedPeople_connection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const pagination = usePublicConnectionPagination({
    pageInfo: data?.recommendedPeople_connection?.pageInfo,
    loadPage,
    resetKey: `${accountDocumentId}:${sectorSlug}`,
  });

  const handlePersonClick = useCallback((person: RecommendedPerson) => {
    setSelectedPerson(person);
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${sectorName} recommendations by ${creatorName}`, url });
      } catch {
        /* ignore */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const pageTitle = `${sectorName} | ${creatorName}'s People Sector | explorers`;
  const metaDescription = `Explore ${sectorPeople.length} people in ${sectorName} recommended by ${creatorName} on explorers.`;
  const seoKeywords = [sectorName, `${creatorName} people`, "people list", "explorers"];

  if (childState === "redirect") return <PublicProfileFallbackRedirect />;
  if (!data) return null;

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/people/sector/${sectorSlug}`)}
          type="website"
          author={creatorName}
          siteName="explorers"
        />
      )}
      <div className="min-h-screen bg-[#0d1117] text-white">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer"
              onClick={() => navigate("/")}
            >
              explorers.earth
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Share"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Header content section */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 mt-14">
          <Link
            to={`/${username}/people`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}'s People
          </Link>

          {(
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">
                  {sectorName}
                </h1>
                <p className="text-gray-400 font-poppins text-xs md:text-sm mt-2">
                  {sectorPeople.length} person{sectorPeople.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Grid of person cards */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {sectorPeople.length === 0 ? (
              <div className="col-span-full py-12 text-center text-white/40 text-sm">
                No people recommended in this sector.
              </div>
            ) : (
              sectorPeople.map((person) => (
                <button
                  key={person.documentId}
                  onClick={() => handlePersonClick(person)}
                  className="flex flex-col items-center gap-2 text-center group"
                >
                  <div className="relative w-24 h-24 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-violet-400/50 transition-all shadow-lg group-hover:scale-105 duration-200">
                    {person.avatar_url ? (
                      <img
                        src={buildImageUrl(person.avatar_url)}
                        alt={person.full_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users size={28} className="text-white/20" />
                      </div>
                    )}
                    {person.platform && (
                      <div className="absolute bottom-1 right-1 p-1 bg-black/60 rounded-full border border-white/10 flex items-center justify-center shadow-md z-10">
                        <PlatformIcon platform={person.platform} size={10} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white line-clamp-1">
                      {person.full_name}
                    </p>
                    {person.handle && (
                      <p className="text-[10px] text-white/40 truncate">@{person.handle}</p>
                    )}
                    {person.headline && (
                      <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">
                        {person.headline}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <PublicConnectionPaginationControl
            hasNextPage={pagination.hasNextPage}
            isLoading={pagination.isLoadingNextPage}
            error={pagination.nextPageError}
            onLoadMore={() => void pagination.loadNextPage()}
            onRetry={() => void pagination.retryNextPage()}
            label="people"
          />
        </div>

        <PersonDetailModal
          open={!!selectedPerson}
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      </div>
    </>
  );
};

export default PublicPersonSector;
