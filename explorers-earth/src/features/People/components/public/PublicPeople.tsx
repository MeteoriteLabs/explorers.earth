import { useState, useMemo, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Users, Share2 } from "lucide-react";
import { PUBLIC_PEOPLE_DATA } from "../../api/query";
import { deduplicatePeople } from "../../utils/personHelpers";
import { toast } from "sonner";
import type { RecommendedPerson, PersonList } from "../../types";
import PersonCarouselRow from "./PersonCarouselRow";
import PersonDetailModal from "./PersonDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import PersonTopPicksHero from "./PersonTopPicksHero";
import PersonTopPicksMobileHero from "./PersonTopPicksMobileHero";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { publicTaxonomyPath } from "../../../../routes/publicTaxonomyRoute";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";

const PublicPeople = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [modalState, setModalState] = useState<{ open: boolean; person: RecommendedPerson | null }>({
    open: false,
    person: null,
  });

  const account = usePublicProfileBootstrapAccount();
  const accountDocumentId = account.documentId;
  const creatorName = account.Account_Name || username;
  const analytics = useTrackAnalytics(createAnalyticsOptions.people(
    accountDocumentId || "",
    username,
    undefined,
    undefined,
    { variant: "index", path: location.pathname },
  ));

  const { data, loading: peopleLoading, error: peopleError, refetch: refetchPeople } = useQuery(PUBLIC_PEOPLE_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const loading = peopleLoading;

  const lists: PersonList[] = data?.personLists ?? [];

  const retry = useCallback(async () => {
    await refetchPeople();
  }, [refetchPeople]);

  usePublicRouteLifecycle({
    loading,
    error: peopleError,
    retry,
    hasUsableData: Boolean(data),
    empty: !loading && !peopleError && lists.length === 0,
  });

  const allPeople = useMemo(() => {
    return deduplicatePeople(lists.flatMap((l) => l.recommended_people ?? []));
  }, [lists]);

  const topPicks = useMemo(() => {
    return allPeople
      .filter((p) => p.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allPeople]);

  const allCategories = useMemo(() => Array.from(
    new Map(
      allPeople.flatMap((person) => person.people_category ? [[
        person.people_category.documentId,
        { documentId: person.people_category.documentId, name: person.people_category.Category_name },
      ] as const] : []),
    ).values(),
  ).sort((left, right) => left.name.localeCompare(right.name)), [allPeople]);

  const handlePersonClick = useCallback((person: RecommendedPerson) => {
    analytics.trackClick("person-card", {
      id: person.documentId,
      name: person.full_name,
      headline: person.headline,
      listId: person.person_list?.documentId,
      listName: person.person_list?.List_Name,
    });
    setModalState({ open: true, person });
  }, [analytics]);

  const handleShare = async () => {
    analytics.trackClick("share-button", { context: "people-index" });
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s People`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const personCount = allPeople.length;
  const listCount = lists.length;
  const pageTitle = `${creatorName} | People & Creators | explorers`;
  const metaDescription = personCount > 0
    ? `Browse people and creator recommendations curated by ${creatorName} on explorers. Explore ${listCount} list${listCount !== 1 ? 's' : ''} featuring ${personCount} inspiring person${personCount !== 1 ? 's' : ''}.`
    : `Explore people recommendations shared by ${creatorName} on explorers.`;

  const seoKeywords = [
    `${creatorName} people`,
    `${username} creators`,
    "explorers people",
    "creator recommendations",
    "curated people lists",
    ...lists.map(l => l.List_Name)
  ];

  if (!data) return null;

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/people`)}
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

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-20">
          <>
              {/* Empty state */}
              {lists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Users size={48} className="text-white/20 mb-4" />
                  <p className="text-white/40 text-lg font-medium">No people shared yet</p>
                  <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
                </div>
              ) : (
                <>
                  {/* Top Picks Hero */}
                  {topPicks.length > 0 && (
                    <div className="mt-4">
                      <div className="hidden lg:block">
                        <PersonTopPicksHero
                          people={topPicks}
                          onPersonClick={handlePersonClick}
                        />
                      </div>
                      <div className="block lg:hidden">
                        <PersonTopPicksMobileHero
                          people={topPicks}
                          onPersonClick={handlePersonClick}
                        />
                      </div>
                    </div>
                  )}

                  {/* Lists as carousel rows */}
                  <div className="mt-4 space-y-8">
                    {lists.map((list) => (
                      <PersonCarouselRow
                        key={list.documentId}
                        list={list}
                        onPersonClick={handlePersonClick}
                        onViewAll={() => navigate(`/${username}/people/${list.slug}`)}
                      />
                    ))}
                  </div>

                  {/* Category browse */}
                  {allCategories.length > 0 && (
                    <div className="mt-10">
                      <p className="text-sm font-semibold text-white/60 mb-3">Browse by Category</p>
                      <div className="flex flex-wrap gap-2">
                        {allCategories.map((cat) => (
                          <button
                            key={cat.documentId}
                            onClick={() => navigate(publicTaxonomyPath(username!, "people", "sector", cat.documentId))}
                            className="text-xs text-violet-400/80 bg-violet-900/20 hover:bg-violet-900/40 border border-violet-800/20 px-3 py-1.5 rounded-full transition-all"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
          </>
        </div>

        <PersonDetailModal
          open={modalState.open}
          person={modalState.person}
          onClose={() => setModalState({ open: false, person: null })}
        />
      </div>
    </>
  );
};

export default PublicPeople;
