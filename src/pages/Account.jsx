import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Package, Sparkles, Heart, ChevronRight, ChevronLeft, LogOut } from "lucide-react";
import { useUser } from "../context/UserContext.jsx";
import { navigate, onRouteChange } from "../lib/navigate.js";
import ProfileTab from "../components/account/ProfileTab.jsx";
import LoyaltyTab from "../components/account/LoyaltyTab.jsx";
import OrdersTab from "../components/account/OrdersTab.jsx";
import WishlistTab from "../components/account/WishlistTab.jsx";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "loyalty", label: "Loyalty Rewards", icon: Sparkles },
  { id: "wishlist", label: "Saved Items", icon: Heart },
];

// Resolve a valid tab id from the URL query (e.g. /account?tab=orders).
// Returns null for plain /account so mobile still opens on the tab menu.
function readTabFromHash() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return TABS.some((t) => t.id === tab) ? tab : null;
}

export default function Account() {
  const { name, authed, logout, openAuth } = useUser();
  // null means mobile menu is showing. Desktop always shows the current tab.
  // Seed from the deep link so #/account?tab=orders lands on My Orders.
  const [activeTab, setActiveTab] = useState(readTabFromHash);
  const currentId = activeTab || "profile";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  // Honor tab changes that arrive while the page is already mounted — e.g. the
  // PDP "review to earn" CTA navigating to /account?tab=orders.
  useEffect(() => onRouteChange(() => {
    const t = readTabFromHash();
    if (t) setActiveTab(t);
  }), []);

  // Guests can reach #/account by deep link — never show a dashboard (or a
  // Sign Out button) for a session that doesn't exist.
  if (!authed) {
    return (
      <div className="min-h-screen pb-28">
        <div className="mx-auto max-w-md px-5 pt-12 text-center sm:px-8">
          <span className="grid h-14 w-14 place-items-center mx-auto rounded-full bg-petal text-magenta">
            <User className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-ink">
            Your glow, saved 🌸
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Log in to see your orders, loyalty points, and saved items.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => openAuth("login")}
              className="rounded-full bg-magenta px-7 py-3.5 text-sm font-semibold text-white shadow-soft transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
            >
              Log In
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:text-magenta hover:ring-magenta"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (currentId) {
      case "profile": return <ProfileTab />;
      case "orders": return <OrdersTab />;
      case "loyalty": return <LoyaltyTab />;
      case "wishlist": return <WishlistTab />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        
        {/* Header - Hidden on mobile when a tab is active to save space */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`${activeTab ? "hidden lg:block" : "block"} mt-12 mb-8 lg:mb-12`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Dashboard
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
            Hi {name} 🌸
          </h1>
        </motion.div>

        <div className="flex flex-col lg:flex-row lg:gap-12 xl:gap-16">
          
          {/* Sidebar Navigation */}
          <aside className={`${activeTab ? "hidden lg:block" : "block"} lg:w-64 shrink-0`}>
            <nav className="flex flex-col gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentId === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all ${
                      isActive
                        ? "bg-snow text-magenta ring-1 ring-line"
                        : "text-ink-soft hover:bg-snow/50 hover:text-ink"
                    }`}
                  >
                    <span className="flex items-center gap-3 font-medium">
                      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
                      {tab.label}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? "translate-x-1" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"}`} />
                  </button>
                );
              })}
              
              <div className="my-4 border-t border-line" />
              
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="flex items-center gap-3 rounded-2xl p-4 text-left font-medium text-ink-soft transition-colors hover:bg-rose/10 hover:text-rose"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.8} />
                Sign Out
              </button>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className={`${!activeTab ? "hidden lg:block" : "block"} min-w-0 flex-1`}>
            
            {/* Mobile Back Button */}
            <button
              onClick={() => setActiveTab(null)}
              className="mt-12 mb-6 flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta lg:hidden"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} /> Back to Menu
            </button>
            
            {/* Tab View Wrapper */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>

          </main>
        </div>
      </div>
    </div>
  );
}
