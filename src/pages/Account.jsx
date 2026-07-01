import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Package, Sparkles, Heart, ChevronRight, ChevronLeft, LogOut } from "lucide-react";
import { useUser } from "../context/UserContext.jsx";
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

export default function Account() {
  const { name, logout } = useUser();
  // null means mobile menu is showing. Desktop always shows the current tab.
  const [activeTab, setActiveTab] = useState(null); 
  const currentId = activeTab || "profile";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

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
    <div className="min-h-screen pb-28 pt-28 sm:pt-32">
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
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink dark:text-white">
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
                        ? "bg-snow text-magenta ring-1 ring-line dark:bg-white/5 dark:ring-white/10"
                        : "text-ink-soft hover:bg-snow/50 hover:text-ink dark:text-white/60 dark:hover:bg-white/[0.02] dark:hover:text-white"
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
              
              <div className="my-4 border-t border-line dark:border-white/10" />
              
              <button
                onClick={() => {
                  logout();
                  window.location.hash = "#/";
                }}
                className="flex items-center gap-3 rounded-2xl p-4 text-left font-medium text-ink-soft transition-colors hover:bg-rose/10 hover:text-rose dark:text-white/60 dark:hover:bg-rose/10 dark:hover:text-rose"
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
              className="mt-12 mb-6 flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta lg:hidden dark:text-white/60"
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
