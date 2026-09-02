import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useOutletContext, useLocation } from "react-router-dom";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { deduplicateProducts, buildImageUrl, formatPrice } from "../../utils/productHelpers";
import type { RecommendedProduct, ProductList } from "../../types";
import ProductDetailModal from "./ProductDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";
import { usePublicHeaderDescriptor } from "../../../PublicHome/components/PublicHeaderDescriptorContext";
import { isNonNullObject, PublicRouteErrorState, PublicRoutePartialNotice } from "../../../PublicHome/components/PublicRouteContentState";
import { usePublicProfileShell } from "../../../PublicHome/api/usePublicProfileShell";
import { usePublicProfileDetail } from "../../../PublicHome/api/usePublicProfileDetail";

const isRenderableProductList = (value: unknown): value is ProductList =>
  isNonNullObject(value) && Array.isArray(value.recommended_products);

const PublicProductList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const location = useLocation();
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();

  const [selectedProduct, setSelectedProduct] = useState<RecommendedProduct | null>(null);

  const { data: accountData } = usePublicProfileShell(username);
  const { data, loading, error, refetch } = usePublicProfileDetail(username, "products", listSlug);

  const list = (Array.isArray(data?.productLists) ? data.productLists : []).find(isRenderableProductList);
  const hasUsableData = Boolean(list);
  const products = deduplicateProducts<RecommendedProduct>(list?.recommended_products ?? []);
  const accountDocumentId = typeof accountData?.documentId === "string" ? accountData.documentId : undefined;
  const creatorName = typeof accountData?.Account_Name === "string" ? accountData.Account_Name : username;
  const analytics = useTrackAnalytics(
    {
      ...createAnalyticsOptions.products(accountDocumentId || "", username, list?.documentId),
      waitForLocation: true,
    },
  );

  useEffect(() => {
    if (!loading || hasUsableData) {
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [hasUsableData, loading, outletContext]);

  const handleProductClick = useCallback((product: RecommendedProduct) => {
    setSelectedProduct(product);
    analytics.trackClick("product-card", {
      id: product.documentId,
      listId: list?.documentId,
      listName: list?.List_Name,
      title: product.title,
      category: product.product_category?.name,
    });
  }, [analytics, list]);

  usePublicHeaderDescriptor(list ? {
    navigationKey: location.key,
    title: list.List_Name,
    url: window.location.href,
    analyticsContext: "products-list-header",
    analyticsMetadata: {
      listId: list.documentId,
      listName: list.List_Name,
    },
  } : undefined);

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
      <div className="min-h-screen bg-[#0d1117] text-white" aria-busy={loading || undefined}>
        {/* Header content section */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
          <Link
            to={`/${username}/products`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}'s Products
          </Link>

          {Boolean(error) && hasUsableData && <PublicRoutePartialNotice message="Some product data is unavailable." />}

          {loading && !hasUsableData ? (
            <>
              <div className="h-7 w-48 bg-white/5 animate-pulse rounded mb-2" />
              <div className="h-4 w-64 bg-white/5 animate-pulse rounded" />
            </>
          ) : error && !hasUsableData ? (
            <PublicRouteErrorState title="Product list unavailable" error={error} onRetry={refetch} />
          ) : list ? (
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
            {loading && !hasUsableData ? (
              [1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="h-52 rounded-2xl bg-white/5 skeleton-shimmer relative overflow-hidden" />
              ))
            ) : (
              products.map((product) => (
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
              ))
            )}
          </div>
        </div>

        <ProductDetailModal
          open={!!selectedProduct}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </div>
    </>
  );
};

export default PublicProductList;
