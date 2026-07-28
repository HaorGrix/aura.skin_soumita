import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import { installLinkInterceptor } from "./lib/navigate.js";
import "./index.css";

// Promote internal <a href="/…"> clicks to SPA navigations (clean-URL router).
installLinkInterceptor();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
