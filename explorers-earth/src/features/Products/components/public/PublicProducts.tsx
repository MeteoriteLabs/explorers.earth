import { useState, useMemo, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ShoppingBag, Share2 } from "lucide-react";
import { PUBLIC_PRODUCT_DATA } from "../../api/query";
import { deduplicateProducts } from "../../utils/productHelpers";
import { toast } from "sonner";
import type { RecommendedProduct, ProductList } from "../../types";
import ProductCarouselRow from "./ProductCarouselRow";
import ProductDetailModal from "./ProductDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import ProductTopPicksHero from "./ProductTopPicksHero";
import ProductTopPicksMobileHero from "./ProductTopPicksMobileHero";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";

const PublicProducts = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [modalState, setModalState] = useState<{ open: boolean; product: RecommendedProduct | null }>({
    open: false,
    product: null,
  });

  const account = usePublicProfileBootstrapAccount();
  const accountDocumentId = account.documentId;
  const creatorName = account.Account_Name || username;
  const analytics = useTrackAnalytics(createAnalyticsOptions.products(
    accountDocumentId || "",
    username,
    undefined,
    undefined,
    { variant: "index", path: location.pathname },
  ));

  const { data, loading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery(PUBLIC_PRODUCT_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const loading = productsLoading;

  const lists: ProductList[] = data?.productLists ?? [];

  const retry = useCallback(async () => {
    await refetchProducts();
  }, [refetchProducts]);

  usePublicRouteLifecycle({
    loading,
    error: productsError,
    retry,
    hasUsableData: Boolean(data),
    empty: !loading && !productsError && lists.length === 0,
  });

  const allProducts = useMemo(() => {
    return deduplicateProducts(lists.flatMap((l) => l.recommended_products ?? []));
  }, [lists]);

  const topPicks = useMemo(() => {
    return allProducts
      .filter((p) => p.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allProducts]);

  // const allCategories = useMemo(() => {
  //   return extractUniqueCategories(allProducts.map((p) => p.product_category ? [p.product_category] : []));
  // }, [allProducts]);

  const handleProductClick = useCallback((product: RecommendedProduct) => {
    analytics.trackClick("product-card", {
      id: product.documentId,
      title: product.title,
      brand: product.brand,
      listId: product.product_list?.documentId,
      listName: product.product_list?.List_Name,
    });
    setModalState({ open: true, product });
  }, [analytics]);

  const handleShare = async () => {
    analytics.trackClick("share-button", { context: "products-index" });
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Products`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const productCount = allProducts.length;
  const listCount = lists.length;
  const pageTitle = `${creatorName} | Favorite Products | explorers`;
  const metaDescription = productCount > 0
    ? `Browse curated product lists and recommendations shared by ${creatorName} on explorers. Explore ${listCount} product list${listCount !== 1 ? 's' : ''} containing ${productCount} favorite product${productCount !== 1 ? 's' : ''}.`
    : `Explore product recommendations shared by ${creatorName} on explorers.`;

  const seoKeywords = [
    `${creatorName} products`,
    `${username} products`,
    "explorers products",
    "favorite products list",
    "product recommendations",
    "curated product lists",
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
          canonical={createCanonicalUrl(`/${username}/products`)}
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
                  <ShoppingBag size={48} className="text-white/20 mb-4" />
                  <p className="text-white/40 text-lg font-medium">No products shared yet</p>
                  <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
                </div>
              ) : (
                <>
                  {/* Top Picks Hero (Large Screens) & Carousel (Mobile) */}
                  {topPicks.length > 0 && (
                    <div className="mt-4">
                      <div className="hidden lg:block">
                        <ProductTopPicksHero 
                          products={topPicks} 
                          onProductClick={handleProductClick} 
                        />
                      </div>
                      <div className="block lg:hidden">
                        <ProductTopPicksMobileHero
                          products={topPicks}
                          onProductClick={handleProductClick}
                        />
                      </div>
                    </div>
                  )}

                  {/* Lists as carousel rows */}
                  <div className="mt-4 space-y-8">
                    {lists.map((list) => (
                      <ProductCarouselRow
                        key={list.documentId}
                        list={list}
                        onProductClick={handleProductClick}
                        onViewAll={() => navigate(`/${username}/products/${list.slug}`)}
                      />
                    ))}
                  </div>

                  {/* Category browse - hidden for now as category pages are not registered/implemented
                  {allCategories.length > 0 && (
                    <div className="mt-10">
                      <p className="text-sm font-semibold text-white/60 mb-3">Browse by Category</p>
                      <div className="flex flex-wrap gap-2">
                        {allCategories.map((cat) => (
                          <button
                            key={cat.slug}
                            onClick={() => navigate(`/${username}/products/category/${cat.slug}`)}
                            className="text-xs text-emerald-400/80 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/20 px-3 py-1.5 rounded-full transition-all"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  */}
                </>
              )}
          </>
        </div>

        <ProductDetailModal
          open={modalState.open}
          product={modalState.product}
          onClose={() => setModalState({ open: false, product: null })}
          onShare={(id) => analytics.trackClick("share-button", { context: "products-index-detail", id })}
        />
      </div>
    </>
  );
};

export default PublicProducts;
