import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import { installLinkInterceptor } from "./lib/navigate.js";
import "./index.css";

// Promote internal <a href="/…"> clicks to SPA navigations (clean-URL router).
installLinkInterceptor();

// A staff password-recovery or invite link must always resolve on /admin —
// that's the only screen that knows how to finish it (SetPassword.jsx).
// Supabase's own "Site URL" is the fallback redirect for anything that
// doesn't set its own `redirectTo` — e.g. a recovery email sent straight
// from the Supabase Dashboard rather than through this app's "Forgot
// password?" link — and Site URL is deliberately the bare domain (customer
// flows need that), so a link like that lands here, on "/", with an
// #access_token=…&type=recovery fragment nothing on this page reads. Caught
// here, before React (or the Supabase client's own hash parsing) even
// starts, so a hard redirect to /admin — preserving the fragment — always
// wins the race and the person actually sees the "set your password" form.
const authRedirectHash = window.location.hash;
const alreadyOnAdmin = window.location.pathname.startsWith("/admin");
if (!alreadyOnAdmin && /type=(recovery|invite)/.test(authRedirectHash)) {
  window.location.replace(`/admin${authRedirectHash}`);
} else {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
