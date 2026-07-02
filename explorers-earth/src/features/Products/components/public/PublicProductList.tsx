import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { PRODUCT_LIST_BY_SLUG } from "../../api/query";
import { deduplicateProducts, buildImageUrl, formatPrice } from "../../utils/productHelpers";
import type { RecommendedProduct } from "../../types";
import ProductDetailModal from "./ProductDetailModal";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameForProductList($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
      }
    }
  }
`;

const PublicProductList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState<RecommendedProduct | null>(null);

  const { data } = useQuery(PRODUCT_LIST_BY_SLUG, {
    variables: { slug: listSlug, username },
    skip: !listSlug || !username,
    fetchPolicy: "cache-and-network",
  });

  const list = data?.productLists?.[0];
  const products = deduplicateProducts(list?.recommended_products ?? []);

  const handleProductClick = useCallback((product: RecommendedProduct) => {
    setSelectedProduct(product);
  }, []);

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <p className="text-white/40 mb-4">List not found.</p>
        <button onClick={() => navigate(`/${username}/products`)} className="text-sm text-emerald-400 hover:underline">
          ← Back to Products
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pb-16">
        <div className="px-4 md:px-6 pt-4 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/${username}/products`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{list.List_Name}</h1>
            {list.list_description && <p className="text-xs text-white/40 mt-0.5">{list.list_description}</p>}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <ShoppingBag size={28} className="text-white/20 mb-3" />
            <p className="text-sm text-white/40">No products in this list.</p>
          </div>
        ) : (
          <div className="px-4 md:px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((product) => (
              <button
                key={product.documentId}
                onClick={() => handleProductClick(product)}
                className="rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.07] p-3 text-left transition-all"
              >
                <div className="w-full h-28 rounded-xl overflow-hidden bg-white/5 mb-2 shadow-md">
                  {product.logo_url ? (
                    <img src={buildImageUrl(product.logo_url)} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={20} className="text-white/20" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1">{product.title}</p>
                {product.brand && <p className="text-[10px] text-white/40 truncate">{product.brand}</p>}
                {product.price && (
                  <p className="text-xs font-bold text-emerald-400 mt-1">{formatPrice(product.price, product.currency)}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <ProductDetailModal
        open={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
};

export default PublicProductList;
