import { ShoppingBag } from "lucide-react";
import type { ProductList, RecommendedProduct } from "../../types";
import { buildImageUrl, formatPrice } from "../../utils/productHelpers";
import { deduplicateProducts } from "../../utils/productHelpers";

interface ProductCarouselRowProps {
  list: ProductList;
  onProductClick: (product: RecommendedProduct) => void;
  onViewAll: () => void;
}

const ProductCarouselRow = ({ list, onProductClick, onViewAll }: ProductCarouselRowProps) => {
  const products = deduplicateProducts(list.recommended_products ?? []);
  if (products.length === 0) return null;

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-white">{list.List_Name}</h2>
          {list.list_description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{list.list_description}</p>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-emerald-400/70 hover:text-emerald-400 font-medium transition-colors whitespace-nowrap"
        >
          View all →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {products.map((product) => (
          <button
            key={product.documentId}
            onClick={() => onProductClick(product)}
            className="flex-shrink-0 w-[140px] rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.07] p-3 text-left transition-all"
          >
            <div className="w-full h-24 rounded-xl overflow-hidden bg-white/5 mb-2 shadow-md">
              {product.logo_url ? (
                <img src={buildImageUrl(product.logo_url)} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag size={20} className="text-white/20" />
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1.5">{product.title}</p>
            {product.brand && (
              <p className="text-[10px] text-white/40 truncate mb-1">{product.brand}</p>
            )}
            {product.price && (
              <p className="text-xs font-bold text-emerald-400">{formatPrice(product.price, product.currency)}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProductCarouselRow;
