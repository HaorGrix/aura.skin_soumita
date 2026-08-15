/* =================================================================== *
 * skin.theory admin — app shell (sidebar + topbar)
 * -------------------------------------------------------------------
 * Nav items declare the minimum role that may see them. That's presentation
 * only — RLS still rejects the write if someone forges their way to a
 * screen. Hiding an item the user can't act on just keeps the panel honest
 * about what it offers.
 * =================================================================== */
import { useEffect, useState } from "react";
import {
  Award, BarChart3, BookOpen, Boxes, ClipboardList, FileText, FolderTree, LayoutDashboard, LogOut,
  Menu, MessageSquareQuote, Package, Percent, Settings as SettingsIcon, ShieldCheck, Tag, Truck, Users, X,
} from "lucide-react";
import { signOut } from "../../lib/api/admin/auth.js";
import { useAdmin } from "../context.js";
import { useStoreSettings } from "../../lib/api/settings.js";

const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, min: "support" },
  ]},
  { group: "Catalog", items: [
    { id: "products",   label: "Products",   icon: Package,  min: "support" },
    { id: "categories", label: "Categories", icon: FolderTree, min: "admin" },
    { id: "brands",     label: "Brands",     icon: Award,    min: "admin" },
    { id: "inventory",  label: "Inventory",  icon: Boxes,    min: "admin" },
  ]},
  { group: "Fulfillment", items: [
    { id: "shipping", label: "Shipping", icon: Truck, min: "admin" },
  ]},
  { group: "Sales", items: [
    { id: "orders",    label: "Orders",    icon: ClipboardList, min: "support" },
    { id: "customers", label: "Customers", icon: Users,         min: "support" },
    { id: "coupons",   label: "Coupons",   icon: Tag,           min: "editor" },
    { id: "sales",     label: "Flash sales", icon: Percent,     min: "editor" },
  ]},
  { group: "Storefront", items: [
    { id: "content",       label: "Content & banners", icon: FileText,          min: "editor" },
    { id: "testimonials",  label: "Testimonials",      icon: MessageSquareQuote, min: "editor" },
    { id: "journal",       label: "Journal",           icon: BookOpen,          min: "editor" },
  ]},
  { group: "System", items: [
    { id: "settings",  label: "Store settings", icon: SettingsIcon, min: "admin" },
    { id: "staff",     label: "Staff & roles",  icon: ShieldCheck,  min: "owner" },
    { id: "audit",     label: "Audit log",      icon: BarChart3,    min: "owner" },
  ]},
];

export default function Shell({ route, onNavigate, children }) {
  const { profile, can } = useAdmin();
  const { storeName } = useStoreSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on navigation, or it stays open over the new screen.
  useEffect(() => { setMobileOpen(false); }, [route.screen, route.id]);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 py-5">
        <a href="/" className="font-serif text-xl text-ink">{storeName}</a>
        <p className="text-[11px] uppercase tracking-widest text-ink-soft">Admin</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((section) => {
          const visible = section.items.filter((i) => can(i.min));
          if (!visible.length) return null;
          return (
            <div key={section.group} className="mb-5">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70">
                {section.group}
              </p>
              {visible.map((item) => {
                const active = route.screen === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(`/admin/${item.id === "dashboard" ? "" : item.id}`)}
                    className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 font-display text-sm font-medium transition-colors ${
                      active ? "bg-petal text-magenta-deep" : "text-ink-soft hover:bg-snow hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="truncate text-xs font-medium text-ink">{profile?.full_name || profile?.email}</p>
        <p className="text-[11px] capitalize text-ink-soft">{profile?.role}</p>
        <button
          onClick={async () => { await signOut(); window.location.href = "/admin"; }}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft hover:text-magenta"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-snow text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:block">
        {nav}
      </aside>

      {/* Mobile drawer — z-modal, per the project's layering rule */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-soft hover:bg-snow" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-[var(--z-sticky)] flex items-center gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-ink hover:bg-snow" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-lg">{storeName} admin</span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
