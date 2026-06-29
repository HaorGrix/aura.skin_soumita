import { motion } from "framer-motion";
import { Heart, ShoppingBag, X } from "lucide-react";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { PRODUCTS } from "../../data/products.js";
import { formatPrice } from "../../lib/format.js";
import { useToast } from "../../components/ui/Toast.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";

export default function WishlistTab() {
  const { items: wishlistIds, toggle, clear } = useWishlist();
  const { addItem, openCart } = useCart();
  const { toast } = useToast();

  // Map ids back to products
  const savedProducts = wishlistIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean);

  const handleMoveToCart = (product) => {
    addItem(product, 1);
    toggle(product.id);
    toast.cart("Moved to your bag");
    openCart();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-ink dark:text-white">Saved Items</h2>
          <p className="mt-1 text-sm text-ink-soft dark:text-white/60">
            {savedProducts.length} {savedProducts.length === 1 ? "item" : "items"} you're eyeing.
          </p>
        </div>
        {savedProducts.length > 0 && (
          <button
            onClick={clear}
            className="text-xs font-medium text-magenta hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {savedProducts.length === 0 ? (
        <EmptyState
          emoji="🤍"
          title="Your wishlist is empty"
          message="Found something you love? Tap the heart icon to save it for later."
          actionLabel="Discover favorites"
          onAction={() => (window.location.hash = "#/shop")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {savedProducts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-line transition-shadow hover:shadow-lift dark:bg-white/[0.03] dark:ring-white/10"
            >
              <button
                onClick={() => toggle(p.id)}
                className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-soft backdrop-blur hover:bg-white hover:text-magenta dark:bg-ink/50 dark:text-white/60 dark:hover:bg-ink dark:hover:text-magenta"
              >
                <X className="h-4 w-4" />
              </button>

              <a
                href={`#/product/${p.id}`}
                className="relative aspect-square w-full overflow-hidden rounded-xl bg-snow dark:bg-white/5"
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${p.tone} 75%, #ffe1ec 100%)` }}
                />
                {p.image && <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal" />}
              </a>

              <div className="mt-4 flex flex-1 flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-magenta">{p.brand}</p>
                <a href={`#/product/${p.id}`} className="mt-1 line-clamp-2 text-sm font-medium leading-tight text-ink hover:text-magenta dark:text-white">
                  {p.name}
                </a>
                <p className="mt-2 text-sm font-semibold text-ink dark:text-white">{formatPrice(p.price)}</p>
              </div>

              <Button
                variant="secondary"
                className="mt-4 w-full text-xs"
                onClick={() => handleMoveToCart(p)}
              >
                <ShoppingBag className="mr-2 h-3.5 w-3.5" /> Move to Cart
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
