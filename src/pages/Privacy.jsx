import PolicyPage from "../components/legal/PolicyPage.jsx";
import { useStoreSettings } from "../lib/api/settings.js";

const UPDATED = "13 August 2026";

export default function Privacy() {
  const { storeName, supportEmail } = useStoreSettings();
  const email = supportEmail || "care@skinscript.com";

  const sections = [
    {
      heading: "1. What this policy covers",
      body: `This policy explains what personal information ${storeName} collects when you browse, create an account, or place an order, why we collect it, and what choices you have. It applies to everyone who uses our website, whether or not you make a purchase.`,
    },
    {
      heading: "2. Information we collect",
      body: "We collect information in three ways: what you give us directly, what's created when you place an order, and what's collected automatically as you browse.",
      list: [
        "Account & contact details — name, email address, and phone number, provided when you sign in, verify your email, or check out as a guest.",
        "Order information — shipping address, items purchased, order value, and delivery zone, needed to fulfil and track your order.",
        "Loyalty & reviews — your points balance, redeemed rewards, and any product reviews you submit against a verified purchase.",
        "Usage data — pages viewed, products browsed, and cart contents, collected automatically to keep the site working (see our Cookie Policy for details).",
      ],
    },
    {
      heading: "3. How we use your information",
      body: "We use your information to run the store, not to build a profile of you for its own sake.",
      list: [
        "Process and deliver your order, including sharing your name, phone number and address with our courier partner.",
        "Send order confirmations, delivery updates, and — only if you've asked for them — newsletter emails.",
        "Calculate and credit loyalty points, and verify that a review is tied to a genuine purchase.",
        "Detect and prevent fraud, such as repeated misuse of a discount code.",
        "Understand which products and pages are working, using aggregated, non-identifying analytics.",
      ],
    },
    {
      heading: "4. Payment information",
      body: `${storeName} currently accepts Cash on Delivery only. We do not collect or store any card, mobile-wallet, or bank-account details, because no online payment is processed through our checkout — you pay the courier directly upon delivery.`,
    },
    {
      heading: "5. Who we share information with",
      body: "We don't sell your data. We share only what's necessary to run the store, with a short, specific list of parties:",
      list: [
        "Our courier partners, to deliver your order — name, phone number, and delivery address only.",
        "Our hosting and database provider (Supabase), which stores account, order, and product data on our behalf under its own security controls.",
        "Meta (Facebook/Instagram), if pixel-based analytics is enabled on the site, for aggregated ad-performance measurement — see our Cookie Policy.",
      ],
    },
    {
      heading: "6. Data retention",
      body: "We keep order records for as long as needed for accounting, warranty, and dispute purposes, and account data for as long as your account stays active. You can ask us to delete your account and associated personal data at any time, subject to what we're legally required to keep (such as transaction records).",
    },
    {
      heading: "7. Your rights",
      body: "You can ask us, at any time, to tell you what personal information we hold about you, correct anything inaccurate, or delete your account. Guest orders are looked up by a magic link sent to your verified email, so only you can access your own order history.",
    },
    {
      heading: "8. Children's privacy",
      body: "Our store is intended for adults purchasing skincare products. We do not knowingly collect personal information from children.",
    },
    {
      heading: "9. Changes to this policy",
      body: "If we make a material change to how we handle your data, we'll update the date at the top of this page. Continuing to use the site after a change means you accept the updated policy.",
    },
    {
      heading: "10. Contact us",
      body: `Questions about this policy or your data? Email us at ${email}, or use the form on our Contact page.`,
    },
  ];

  return (
    <PolicyPage
      route="privacy"
      eyebrow="Legal"
      title="Privacy Policy"
      updated={UPDATED}
      intro={`Your trust matters as much as your skin's barrier. Here's exactly what ${storeName} collects, why, and how you stay in control of it.`}
      sections={sections}
    />
  );
}
