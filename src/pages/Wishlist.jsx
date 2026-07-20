import { motion } from "framer-motion";
import { Heart, ShoppingBag, X, Trash2 } from "lucide-react";
import { useWishlist } from "../context/WishlistContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { PRODUCTS } from "../data/products.js";
import { formatPrice } from "../lib/format.js";
import EmptyState from "../components/ui/EmptyState.jsx";
import Button from "../components/ui/Button.jsx";

export default function Wishlist() {
  const { items: wishlistIds, toggle, clear } = useWishlist();
  const { addItem, openCart } = useCart();
  const { toast } = useToast();

  const savedProducts = wishlistIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean);

  const handleMoveToCart = (product) => {
    // The cart refuses sold-out items, so removing it from the wishlist here
    // would silently destroy the save and never add anything to the bag.
    if (!product.inStock) {
      toast.error("This one's sold out — we'll keep it saved for you.", "Out of stock");
      return;
    }
    addItem(product, 1);
    toggle(product.id);
    toast.cart(`${product.brand} — ${product.name}`);
    openCart();
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 flex items-end justify-between"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              Your favorites
            </p>
            <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
              Wishlist 🤍
            </h1>
            {savedProducts.length > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                {savedProducts.length} {savedProducts.length === 1 ? "item" : "items"} saved
              </p>
            )}
          </div>
          {savedProducts.length > 0 && (
            <button
              onClick={clear}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-rose"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              Clear all
            </button>
          )}
        </motion.div>

        {savedProducts.length === 0 ? (
          <EmptyState
            emoji="🤍"
            title="Your wishlist is empty"
            message="Browse the shop and tap the ♡ on products you love to save them here."
            actionLabel="Discover favorites"
            onAction={() => (window.location.hash = "#/shop")}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                layout
                className="group relative flex flex-col overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
              >
                {/* Remove button */}
                <button
                  onClick={() => {
                    toggle(p.id);
                    toast.show({ title: "Removed", message: p.name, variant: "info" });
                  }}
                  className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-soft backdrop-blur transition-colors hover:bg-rose/10 hover:text-rose"
                  aria-label="Remove from wishlist"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>

                {/* Product image */}
                <a
                  href={`#/product/${p.id}`}
                  className="relative aspect-square w-full overflow-hidden bg-snow"
                  style={{
                    background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${p.tone} 75%, #ffe1ec 100%)`,
                  }}
                >
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105 mix-blend-multiply"
                    />
                  )}
                </a>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-magenta">
                    {p.brand}
                  </p>
                  <a
                    href={`#/product/${p.id}`}
                    className="mt-1 line-clamp-2 font-serif text-base leading-snug text-ink transition-colors hover:text-magenta"
                  >
                    {p.name}
                  </a>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatPrice(p.price)}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 text-xs"
                      onClick={() => handleMoveToCart(p)}
                    >
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                      Add to Bag
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
