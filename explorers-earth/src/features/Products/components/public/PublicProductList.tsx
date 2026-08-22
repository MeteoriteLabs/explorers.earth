import { useState, useCallback } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ShoppingBag, Share2, ArrowLeft } from "lucide-react";
import { PRODUCT_LIST_BY_SLUG } from "../../api/query";
import { deduplicateProducts, buildImageUrl, formatPrice } from "../../utils/productHelpers";
import type { RecommendedProduct, ProductList } from "../../types";
import ProductDetailModal from "./ProductDetailModal";
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
import {
  publicLeafQueryContext,
  usePublicLeafRequestGeneration,
} from "../../../../layouts/PublicRouteReadinessContext";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";

const PublicProductList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<RecommendedProduct | null>(null);

  const account = usePublicProfileBootstrapAccount();
  const requestGeneration = usePublicLeafRequestGeneration(`${account.documentId}:${listSlug}`);

  const { data, loading, error, refetch, fetchMore } = useQuery(PRODUCT_LIST_BY_SLUG, {
    context: publicLeafQueryContext,
    variables: {
      slug: listSlug,
      accountDocumentId: account.documentId,
      pagination: { page: 1, pageSize: 200 },
    },
    skip: !listSlug || !account.documentId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const list: ProductList | undefined = data?.productLists?.[0];
  const products = deduplicateProducts<RecommendedProduct>(
    data?.recommendedProducts_connection?.nodes ?? [],
  );
  const creatorName = account.Account_Name || username;
  const analytics = useTrackAnalytics(createAnalyticsOptions.products(
    list ? account.documentId : "",
    username,
    list?.documentId,
    undefined,
    { variant: "list", path: location.pathname },
  ));
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(account.documentId && listSlug),
    resourceKind: "child",
    entityExists: Boolean(list),
    empty: Boolean(list) && products.length === 0,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: childState === "empty",
  });

  const loadPage = useCallback(async (page: number, request: { isCurrent: () => boolean }) => {
    await fetchMore({
      variables: { pagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!request.isCurrent()) return previous;
        if (!previous.recommendedProducts_connection || !fetchMoreResult?.recommendedProducts_connection) return previous;
        return {
          ...previous,
          recommendedProducts_connection: mergePublicConnectionPage(
            previous.recommendedProducts_connection,
            fetchMoreResult.recommendedProducts_connection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const pagination = usePublicConnectionPagination({
    pageInfo: data?.recommendedProducts_connection?.pageInfo,
    loadPage,
    resetKey: `${account.documentId}:${listSlug}`,
  });

  const handleProductClick = useCallback((product: RecommendedProduct) => {
    analytics.trackClick("product-card", {
      id: product.documentId,
      title: product.title,
      brand: product.brand,
      listId: list?.documentId,
      listName: list?.List_Name,
    });
    setSelectedProduct(product);
  }, [analytics, list?.List_Name, list?.documentId]);

  const handleShare = async () => {
    analytics.trackClick("share-button", { context: "products-list", listId: list?.documentId });
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: list?.List_Name, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const pageTitle = list ? `${list.List_Name} | ${creatorName}'s Product List | explorers` : `Product List | explorers`;
  const metaDescription = list?.list_description 
    ? list.list_description 
    : list 
      ? `Explore the curated product list "${list.List_Name}" containing ${products.length} products recommended by ${creatorName} on explorers.`
      : "Explore product recommendations on explorers.";

  const seoKeywords = list 
    ? [`${list.List_Name}`, `${creatorName} products`, `${list.slug}`, "product list", "explorers"]
    : ["product list", "explorers"];

  const listImage = list?.cover_image?.url || (products[0]?.logo_url ? buildImageUrl(products[0].logo_url) : undefined);

  if (childState === "redirect") return <PublicProfileFallbackRedirect expectedGeneration={requestGeneration} />;
  if (!data) return null;

  return (
    <>
      {!loading && list && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/products/${listSlug}`)}
          image={listImage}
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
            to={`/${username}/products`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}'s Products
          </Link>

          {list ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">{list.List_Name}</h1>
                {list.list_description && (
                  <p className="text-gray-400 font-poppins text-xs md:text-sm mt-1 max-w-xl">{list.list_description}</p>
                )}
                <p className="text-gray-400 font-poppins text-xs md:text-sm mt-2">{products.length} product{products.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : (
            <p className="text-white/40">List not found or not published.</p>
          )}
        </div>

        {/* Grid */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map((product) => (
                <button
                  key={product.documentId}
                  onClick={() => handleProductClick(product)}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.07] p-4 text-left transition-all flex flex-col w-full"
                >
                  <div className="w-full h-28 rounded-xl overflow-hidden bg-white/5 mb-3 shadow-md">
                    {product.logo_url ? (
                      <img src={buildImageUrl(product.logo_url)} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={20} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1">{product.title}</p>
                  {product.brand && (
                    <p className="text-[10px] text-white/40 truncate w-full mb-2">{product.brand}</p>
                  )}
                  {product.price && (
                    <p className="text-xs font-bold text-emerald-400 mt-auto">{formatPrice(product.price, product.currency)}</p>
                  )}
                </button>
            ))}
          </div>
          <PublicConnectionPaginationControl
            hasNextPage={pagination.hasNextPage}
            isLoading={pagination.isLoadingNextPage}
            error={pagination.nextPageError}
            onLoadMore={() => void pagination.loadNextPage()}
            onRetry={() => void pagination.retryNextPage()}
            labelKey="sections.productCategories.categories.6.label"
          />
        </div>

        <ProductDetailModal
          open={!!selectedProduct}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onShare={(id) => analytics.trackClick("share-button", { context: "products-list-detail", id })}
        />
      </div>
    </>
  );
};

export default PublicProductList;
