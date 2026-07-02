import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, MoreVertical, Trash2, Loader2, ShoppingBag, Pencil, Copy, Check } from "lucide-react";
import { AddIcon } from "../../../../assets/icons/AddIcon";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import Accordion from "../../../../components/ui/Accordian";
import useAuthStore from "../../../../store/store";
import { PRODUCTS_BY_LIST, productsByListVars } from "../../api/query";
import { UPDATE_PRODUCT_LIST, DELETE_PRODUCT_LIST, TOGGLE_PRODUCT_PIN, DELETE_RECOMMENDED_PRODUCT } from "../../api/mutation";
import { deduplicateProducts, buildImageUrl, extractNoteText, formatPrice } from "../../utils/productHelpers";
import type { RecommendedProduct, ProductList } from "../../types";
import Switch from "../../../../components/ui/Switch";
import ProductDetailModal from "../public/ProductDetailModal";
import { ListVisibilityModal } from "../../../../components/ListVisibilityModal";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;

interface ProductRowProps {
  product: RecommendedProduct;
  onPinToggle: (product: RecommendedProduct) => void;
  onEdit: (product: RecommendedProduct) => void;
  onDelete: (product: RecommendedProduct) => void;
  onClick: (product: RecommendedProduct) => void;
  isPinning: boolean;
}

const ProductRow = ({ product, onPinToggle, onEdit, onDelete, onClick, isPinning }: ProductRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const notePreview = extractNoteText(product.user_recommendation_note);
  const imgUrl = buildImageUrl(product.logo_url);
  const priceStr = formatPrice(product.price, product.currency);

  return (
    <div
      className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.08] hover:bg-white/[0.06] cursor-pointer rounded-xl transition-all mb-2"
      onClick={() => onClick(product)}
    >
      <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-white/5 shadow-sm">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={14} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{product.title}</p>
        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
          {product.brand && <span className="truncate max-w-[120px]">{product.brand}</span>}
          {priceStr && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-emerald-400/80 font-semibold">{priceStr}</span>
            </>
          )}
          {product.user_rating && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5 text-amber-400/80">
                <Star size={10} fill="currentColor" /> {product.user_rating}
              </span>
            </>
          )}
        </div>
        {notePreview && (
          <p className="text-[11px] text-white/30 truncate mt-1 italic line-clamp-1">{notePreview.replace(/<[^>]+>/g, "")}</p>
        )}
      </div>

      {/* Pin */}
      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(product); }}
        className={`flex-shrink-0 text-sm transition-all ${product.is_pinned ? "text-amber-400" : "text-white/20 hover:text-white/50"}`}
        disabled={isPinning}
        title={product.is_pinned ? "Unpin" : "Pin to Top"}
      >
        {isPinning ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={product.is_pinned ? "currentColor" : "none"} />}
      </button>

      {/* Menu */}
      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
        >
          <MoreVertical size={15} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-20 w-32 bg-dashboard-sidebar border border-dashboard-border rounded-xl shadow-xl py-1 text-xs">
            <button onClick={() => { setMenuOpen(false); onEdit(product); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 text-white/70 hover:text-white">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={() => { setMenuOpen(false); onDelete(product); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-900/20 text-red-400">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ProductListView Main Component
// ─────────────────────────────────────────────────────────────
const ProductListView = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [selectedProduct, setSelectedProduct] = useState<RecommendedProduct | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, loading, refetch } = useQuery(PRODUCTS_BY_LIST, {
    variables: productsByListVars(listId!),
    skip: !listId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (location.state?.refetch) { refetch(); window.history.replaceState({}, document.title); }
  }, [location.state, refetch]);

  const [updateProductList] = useMutation(UPDATE_PRODUCT_LIST);
  const [deleteProductList] = useMutation(DELETE_PRODUCT_LIST);
  const [togglePin] = useMutation(TOGGLE_PRODUCT_PIN);
  const [deleteProduct] = useMutation(DELETE_RECOMMENDED_PRODUCT);

  const listData: ProductList | null = data?.productLists?.[0] ?? null;
  const products = deduplicateProducts(listData?.recommended_products ?? []);

  const publicUrl = listData ? `${VITE_BASE_URL}/${user?.username}/products/${listData.slug}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePinToggle = async (product: RecommendedProduct) => {
    setPinningId(product.documentId);
    const pinnedProducts = products.filter((p) => p.is_pinned && p.documentId !== product.documentId);
    const newPinOrder = product.is_pinned ? null : pinnedProducts.length;
    try {
      await togglePin({
        variables: { documentId: product.documentId, is_pinned: !product.is_pinned, pin_order: newPinOrder },
        refetchQueries: [{ query: PRODUCTS_BY_LIST, variables: productsByListVars(listId!) }],
      });
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const handleDelete = async (product: RecommendedProduct) => {
    if (!window.confirm(`Delete "${product.title}"?`)) return;
    setDeletingId(product.documentId);
    try {
      await deleteProduct({
        variables: { documentId: product.documentId },
        refetchQueries: [{ query: PRODUCTS_BY_LIST, variables: productsByListVars(listId!) }],
      });
      toast.success("Product removed.");
    } catch {
      toast.error("Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteList = async () => {
    if (!listData || !window.confirm(`Delete list "${listData.List_Name}"?`)) return;
    try {
      await deleteProductList({ variables: { documentId: listData.documentId } });
      toast.success("List deleted.");
      navigate("/recommendations/products");
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  if (loading && !listData) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>;
  }

  if (!listData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-dashboard-muted mb-4">List not found.</p>
        <button onClick={() => navigate("/recommendations/products")} className="text-sm text-emerald-400 hover:underline">Back to Products</button>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-6 pt-2 pb-24 md:pb-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/recommendations/products")} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dashboard truncate">{listData.List_Name}</h1>
          {listData.list_description && <p className="text-xs text-dashboard-muted truncate">{listData.list_description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dashboard-muted">Public</span>
          <Switch checked={listData.Visibility} onChange={() => setShowVisibilityModal(true)} disabled={products.length === 0} />
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/recommendations/products/${listId}/add`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-medium transition-colors shadow-lg shadow-emerald-900/20"
        >
          <AddIcon size="4" /><span>Add Product</span>
        </button>
        {publicUrl && (
          <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        )}
        <button onClick={handleDeleteList} className="ml-auto flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-sm text-red-400 transition-colors">
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete List</span>
        </button>
      </div>

      {/* QR */}
      {listData.Visibility && publicUrl && (
        <Accordion title="Public Link & QR Code">
          <div className="flex flex-col sm:flex-row gap-4 items-start p-4">
            <QRCodeSVG value={publicUrl} size={96} bgColor="transparent" fgColor="#34d399" />
            <div className="flex-1">
              <p className="text-xs text-dashboard-muted mb-1">Share this link</p>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:underline break-all">{publicUrl}</a>
            </div>
          </div>
        </Accordion>
      )}

      {/* Products list */}
      <div className="mt-6">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-emerald-500/60" />
            </div>
            <p className="text-sm text-dashboard-muted mb-4">No products in this list yet.</p>
            <button onClick={() => navigate(`/recommendations/products/${listId}/add`)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white">
              <AddIcon size="4" /> Add First Product
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {products.map((product) => (
              <motion.div
                key={product.documentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: deletingId === product.documentId ? 0.4 : 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <ProductRow
                  product={product}
                  onClick={setSelectedProduct}
                  onPinToggle={handlePinToggle}
                  onEdit={(p) => navigate(`/recommendations/products/${listId}/edit/${p.documentId}`)}
                  onDelete={handleDelete}
                  isPinning={pinningId === product.documentId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {selectedProduct && (
        <ProductDetailModal open={!!selectedProduct} product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {showVisibilityModal && listData && (
        <ListVisibilityModal
          isOpen={showVisibilityModal}
          onClose={() => setShowVisibilityModal(false)}
          listDocumentId={listData.documentId}
          currentVisibility={listData.Visibility}
          listName={listData.List_Name}
          updateMutation={UPDATE_PRODUCT_LIST}
          refetchQuery={PRODUCTS_BY_LIST}
          refetchVars={productsByListVars(listId!)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

export default ProductListView;
