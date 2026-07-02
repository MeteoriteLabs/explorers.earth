import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { ShoppingBag, Share2 } from "lucide-react";
import { PUBLIC_PRODUCT_DATA } from "../../api/query";
import { deduplicateProducts, extractUniqueCategories } from "../../utils/productHelpers";
import { toast } from "sonner";
import type { RecommendedProduct, ProductList } from "../../types";
import ProductCarouselRow from "./ProductCarouselRow";
import ProductDetailModal from "./ProductDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameProducts($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
        profile_picture {
          url
        }
      }
    }
  }
`;

const PublicProducts = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();

  const [modalState, setModalState] = useState<{ open: boolean; product: RecommendedProduct | null }>({
    open: false,
    product: null,
  });

  const { data: userLookup, loading: userLoading } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;
  const creatorName = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.Account_Name || username;

  const { data, loading: productsLoading } = useQuery(PUBLIC_PRODUCT_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const loading = userLoading || productsLoading;

  useEffect(() => {
    if (!loading) {
      (window as any).__publicProfileLoaded = true;
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [loading, outletContext]);

  const lists: ProductList[] = data?.productLists ?? [];

  const allProducts = useMemo(() => {
    return deduplicateProducts(lists.flatMap((l) => l.recommended_products ?? []));
  }, [lists]);

  const topPicks = useMemo(() => {
    return allProducts
      .filter((p) => p.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allProducts]);

  const allCategories = useMemo(() => {
    return extractUniqueCategories(allProducts.map((p) => p.product_category ?? []));
  }, [allProducts]);

  const handleProductClick = useCallback((product: RecommendedProduct) => {
    setModalState({ open: true, product });
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Products`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center mb-5">
          <ShoppingBag size={32} className="text-emerald-500/50" />
        </div>
        <h2 className="text-lg font-semibold text-white/80 mb-2">No products shared yet</h2>
        <p className="text-sm text-white/40 max-w-sm">
          {creatorName} hasn't published any product lists yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${creatorName}'s Products`}
        description={`Discover product recommendations from ${creatorName}.`}
        canonicalUrl={createCanonicalUrl(`/${username}/products`)}
      />

      <div className="pb-16">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Products</h1>
            <p className="text-xs text-white/40 mt-0.5">{allProducts.length} products curated by {creatorName}</p>
          </div>
          <button onClick={handleShare} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
            <Share2 size={16} />
          </button>
        </div>

        {/* Top Picks grid */}
        {topPicks.length > 0 && (
          <div className="mt-2 mb-4 px-4 md:px-6">
            <p className="text-xs text-emerald-400/70 font-semibold uppercase tracking-wider mb-3">⭐ Top Picks</p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {topPicks.map((product) => (
                <button
                  key={product.documentId}
                  onClick={() => handleProductClick(product)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 w-20 group"
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-emerald-500/40 transition-all shadow-lg">
                    {product.logo_url ? (
                      <img src={product.logo_url} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={18} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-white/50 text-center line-clamp-2 leading-tight">{product.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lists as carousels */}
        <div className="space-y-8 mt-4">
          {lists.map((list) => (
            <ProductCarouselRow
              key={list.documentId}
              list={list}
              onProductClick={handleProductClick}
              onViewAll={() => navigate(`/${username}/products/${list.slug}`)}
            />
          ))}
        </div>

        {/* Category browse */}
        {allCategories.length > 0 && (
          <div className="px-4 md:px-6 mt-10">
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
      </div>

      <ProductDetailModal
        open={modalState.open}
        product={modalState.product}
        onClose={() => setModalState({ open: false, product: null })}
      />
    </>
  );
};

export default PublicProducts;
