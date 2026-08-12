/* =================================================================== *
 * skin.theory — Admin panel root
 * -------------------------------------------------------------------
 * Mounted by App.jsx for any /admin* path, OUTSIDE the storefront chrome:
 * no Lenis smooth scroll, no Loader, no Navbar, no FloatingCart. The admin
 * is a working tool — native scrolling and instant paint beat choreography.
 *
 * Access is gated twice, on purpose:
 *   1. Here, by session + profile role — decides what renders.
 *   2. In Postgres, by RLS — decides what the database will actually do.
 * The second one is the real boundary. This one is just courtesy.
 * =================================================================== */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/api/client.js";
import {
  getStaffProfile, getPendingInvite, acceptInvite, onAuthChange, hasRole, consumeAuthRedirectError,
} from "../lib/api/admin/auth.js";
import { AdminContext } from "./context.js";
import Shell from "./layout/Shell.jsx";
import Login from "./screens/Login.jsx";
import SetPassword from "./screens/SetPassword.jsx";
import { Spinner } from "./components/kit.jsx";

const Dashboard   = lazy(() => import("./screens/Dashboard.jsx"));
const Products    = lazy(() => import("./screens/Products.jsx"));
const ProductEdit = lazy(() => import("./screens/ProductEdit.jsx"));
const Categories  = lazy(() => import("./screens/Categories.jsx"));
const Brands      = lazy(() => import("./screens/Brands.jsx"));
const Inventory   = lazy(() => import("./screens/Inventory.jsx"));
const Shipping    = lazy(() => import("./screens/Shipping.jsx"));
const Orders      = lazy(() => import("./screens/Orders.jsx"));
const OrderDetail = lazy(() => import("./screens/OrderDetail.jsx"));
const Customers   = lazy(() => import("./screens/Customers.jsx"));
const Content     = lazy(() => import("./screens/Content.jsx"));
const ContentEdit = lazy(() => import("./screens/ContentEdit.jsx"));
const Coupons     = lazy(() => import("./screens/Coupons.jsx"));
const Sales       = lazy(() => import("./screens/Sales.jsx"));
const Testimonials = lazy(() => import("./screens/Testimonials.jsx"));
const Settings    = lazy(() => import("./screens/Settings.jsx"));
const Staff       = lazy(() => import("./screens/Staff.jsx"));
const Audit       = lazy(() => import("./screens/Audit.jsx"));

/** Parse /admin/... into a screen + optional id. Mirrors the storefront's
 *  own minimal History-API router rather than pulling in a routing dep. */
function parseAdminRoute() {
  const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  // parts[0] === "admin"
  const screen = parts[1] ?? "dashboard";
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;
  return { screen, id };
}

export function adminNavigate(to) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function AdminApp() {
  const [route, setRoute] = useState(parseAdminRoute);
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  // Read once, on mount, before Supabase's own session-from-URL parsing has
  // a chance to run again on a later render — an expired/reused link's
  // error params need to be caught on the very first pass.
  const [linkError] = useState(() => consumeAuthRedirectError());

  useEffect(() => {
    const onPop = () => setRoute(parseAdminRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The admin runs on a light surface; the storefront is dark by default.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light");
    root.classList.add("admin-active");
    return () => {
      if (previous) root.setAttribute("data-theme", previous);
      else root.removeAttribute("data-theme");
      root.classList.remove("admin-active");
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    return onAuthChange((s, event) => {
      // A reset link produces a real session, so without this flag the user
      // would land on the dashboard and never set the password they came for.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);

      /* Only update `session` state when the SIGNED-IN USER actually
       * changes — not on every auth event. The Supabase client refreshes
       * its JWT automatically (autoRefreshToken: true) whenever the tab
       * regains focus, firing TOKEN_REFRESHED with a new session object
       * every time even though it's the same user. Calling setSession()
       * unconditionally there gave `session` a new reference on every tab
       * refocus, which changed loadProfile's identity (it depends on
       * `session`), which re-ran the effect below, which set
       * profileLoading(true) — and the loading gate a few lines down
       * unmounts <Screen> (and whatever admin form was open inside it)
       * the entire time profileLoading is true. That's the "form resets
       * when I switch tabs and come back" bug.
       *
       * The functional update returns the SAME `prev` reference when the
       * user id hasn't changed, so React bails out of the state update
       * entirely — no re-render, no effect re-run, no remount. A real
       * sign-in/out (different or null user id) still updates normally. */
      setSession((prev) => (prev?.user?.id === (s?.user?.id ?? null) ? prev : (s ?? null)));
    });
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session) { setProfile(null); setPendingInvite(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    const { data } = await getStaffProfile();
    setProfile(data);
    // No active staff profile could mean "not staff at all" or "invited,
    // hasn't accepted yet" — check the latter before falling back to Login.
    if (!data) {
      const { data: invite } = await getPendingInvite();
      setPendingInvite(invite);
    } else {
      setPendingInvite(null);
    }
    setProfileLoading(false);
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const ctx = useMemo(
    () => ({ profile, role: profile?.role ?? null, can: (min) => hasRole(profile?.role, min), reloadProfile: loadProfile }),
    [profile, loadProfile]
  );

  // Password recovery is checked before the loading gate: the reset link
  // carries a session, and the user must land on the set-password screen even
  // while their profile is still being fetched.
  if (recovering && session) {
    return (
      <SetPassword
        email={session.user?.email}
        onDone={() => { setRecovering(false); loadProfile(); }}
      />
    );
  }

  if (session === undefined || (session && profileLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-snow">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Invited but hasn't set a password yet: same screen as password reset,
  // but activates the account (accept_staff_invite) right after, so
  // "accepted" always means the account actually works.
  if (session && !profile && pendingInvite) {
    return (
      <SetPassword
        email={session.user?.email}
        heading="Set your password"
        doneCopy="You're all set — welcome aboard."
        onAfterPassword={acceptInvite}
        onDone={() => loadProfile()}
      />
    );
  }

  // Signed out, or signed in without a staff profile — both land on Login,
  // which explains the difference and offers the sign-in-link / reset paths.
  if (!session || !profile) {
    return <Login session={session} onSignedIn={loadProfile} linkError={linkError} />;
  }

  return (
    <AdminContext.Provider value={ctx}>
      <Shell route={route} onNavigate={adminNavigate}>
        <Suspense fallback={<div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>}>
          <Screen route={route} />
        </Suspense>
      </Shell>
    </AdminContext.Provider>
  );
}

function Screen({ route }) {
  const { screen, id } = route;
  switch (screen) {
    case "dashboard": return <Dashboard />;
    case "products":  return id ? <ProductEdit id={id} /> : <Products />;
    case "categories": return <Categories />;
    case "brands":    return <Brands />;
    case "inventory": return <Inventory />;
    case "shipping": return <Shipping />;
    case "orders":    return id ? <OrderDetail id={id} /> : <Orders />;
    case "customers": return <Customers />;
    case "content":   return id ? <ContentEdit slot={id} /> : <Content />;
    case "coupons":   return <Coupons />;
    case "sales":     return <Sales />;
    case "testimonials": return <Testimonials />;
    case "settings":  return <Settings />;
    case "staff":     return <Staff />;
    case "audit":     return <Audit />;
    default:
      return (
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-line">
          <p className="font-serif text-2xl text-ink">Page not found</p>
          <p className="mt-1 text-sm text-ink-soft">No admin screen matches “{screen}”.</p>
        </div>
      );
  }
}
