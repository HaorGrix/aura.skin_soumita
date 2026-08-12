import PolicyPage from "../components/legal/PolicyPage.jsx";
import { useStoreSettings } from "../lib/api/settings.js";

const UPDATED = "13 August 2026";

export default function Cookies() {
  const { storeName, supportEmail } = useStoreSettings();
  const email = supportEmail || "care@skinscript.com";

  const sections = [
    {
      heading: "1. What cookies (and similar storage) are",
      body: `"Cookies" are small pieces of data a website stores in your browser. ${storeName} also uses your browser's local storage for the same kind of purpose — remembering things between visits without needing an account. This policy covers both.`,
    },
    {
      heading: "2. Essential storage — always on",
      body: "These make the site actually work, and can't be switched off without breaking basic features like your shopping bag.",
      list: [
        "Your shopping bag contents, so items stay in your cart between visits.",
        "Your saved items (wishlist).",
        "Your logged-in session, so you don't have to sign in again on every page.",
        "In-progress checkout details, so you don't lose your delivery address if you navigate away mid-checkout.",
      ],
    },
    {
      heading: "3. Analytics & advertising — only if enabled",
      body: `If Meta Pixel is turned on in our store settings, Meta (Facebook/Instagram) sets cookies to measure how effective our ads are and to understand aggregated shopping behaviour, such as which products get added to a bag. This never includes your name, address, or payment details — we don't collect or store payment details at all, since ${storeName} is Cash on Delivery only.`,
    },
    {
      heading: "4. Cookies we do not use",
      body: "We don't use cookies to track you across other websites for our own purposes, sell your browsing data, or build an advertising profile beyond what's described above.",
    },
    {
      heading: "5. Managing cookies",
      body: "Most browsers let you view, delete, and block cookies through their settings. Blocking essential storage will affect core features like your cart. You can also opt out of Meta's ad cookies directly through Meta's own ad preferences, or by using your browser's tracking-protection settings.",
    },
    {
      heading: "6. Changes to this policy",
      body: "If what we use changes, we'll update the date at the top of this page.",
    },
    {
      heading: "7. Contact us",
      body: `Questions about our use of cookies? Email ${email}, or use the form on our Contact page.`,
    },
  ];

  return (
    <PolicyPage
      route="cookies"
      eyebrow="Legal"
      title="Cookie Policy"
      updated={UPDATED}
      intro="A short, honest list of what we store in your browser and why — no jargon, no dark patterns."
      sections={sections}
    />
  );
}
