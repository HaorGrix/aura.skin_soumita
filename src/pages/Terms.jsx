import PolicyPage from "../components/legal/PolicyPage.jsx";
import { useStoreSettings } from "../lib/api/settings.js";

const UPDATED = "13 August 2026";

export default function Terms() {
  const { storeName, supportEmail } = useStoreSettings();
  const email = supportEmail || "care@skinscript.com";

  const sections = [
    {
      heading: "1. Acceptance of these terms",
      body: `By browsing ${storeName} or placing an order, you agree to these Terms of Service. If you don't agree with any part of them, please don't use the site.`,
    },
    {
      heading: "2. Who can order",
      body: "You must be at least 18 years old, or placing an order with the consent of a parent or guardian, to purchase from us. Orders must be delivered to an address within Bangladesh.",
    },
    {
      heading: "3. Products & pricing",
      body: "We do our best to keep prices, stock levels, and product descriptions accurate. Occasionally a listed price or stock count may be wrong — if that happens on an order you've already placed, we'll contact you before dispatch with the correction, and you can choose to continue or cancel. All prices are shown in Bangladeshi Taka (৳) and include any applicable tax.",
    },
    {
      heading: "4. Payment",
      body: `We currently accept Cash on Delivery (COD) only — you pay our courier partner in cash when your order arrives. No online payment gateway is used, and we never ask for card or banking details.`,
    },
    {
      heading: "5. Shipping & delivery",
      body: "Delivery charges are calculated by delivery zone and shown at checkout before you confirm your order — see our Shipping & Returns page for the current rates and coverage. Delivery timelines are estimates, not guarantees; delays with our courier partner are outside our direct control, but we'll help you track and resolve any issue.",
    },
    {
      heading: "6. Order acceptance & cancellation",
      body: "Placing an order is an offer to buy, which we accept when we dispatch it. We reserve the right to cancel an order — for example if an item turns out to be out of stock, or we suspect fraudulent use of a discount code — in which case we'll notify you and you won't be charged anything, since payment is only collected on delivery.",
    },
    {
      heading: "7. Returns & refunds",
      body: "Our return and refund process is set out in full on the Shipping & Returns page. In short: unopened items in original condition can be returned within the stated window, and since orders are paid on delivery, an approved refund is issued to the account or method we agree with you directly.",
    },
    {
      heading: "8. Product authenticity",
      body: `Every product listed on ${storeName} is sourced from authorised distributors. If you ever have reason to doubt the authenticity of an item you received, contact us immediately with your order number — we take this seriously and will investigate.`,
    },
    {
      heading: "9. Your account & loyalty points",
      body: "Loyalty points earned through purchases or verified reviews have no cash value, can't be transferred between accounts, and may be adjusted if we find they were earned through abuse of a promotion (such as a fraudulent review). We may suspend an account that we reasonably believe is being used to abuse discount codes or our returns policy.",
    },
    {
      heading: "10. Reviews",
      body: "Reviews can only be written against a product you've actually purchased, verified against your order history. Reviews must be your own genuine experience — we may remove reviews that are abusive, fake, or unrelated to the product.",
    },
    {
      heading: "11. Limitation of liability",
      body: `To the extent permitted by law, ${storeName} is not liable for indirect or consequential losses arising from use of the site or a delayed delivery. This doesn't limit any liability that can't be excluded under the laws of Bangladesh.`,
    },
    {
      heading: "12. Governing law",
      body: "These terms are governed by the laws of Bangladesh, and any dispute will be subject to the exclusive jurisdiction of the courts of Bangladesh.",
    },
    {
      heading: "13. Changes to these terms",
      body: "We may update these terms from time to time — the date at the top of this page always shows the current version. Continuing to use the site after a change means you accept the update.",
    },
    {
      heading: "14. Contact us",
      body: `Questions about these terms? Email ${email}, or use the form on our Contact page.`,
    },
  ];

  return (
    <PolicyPage
      route="terms"
      eyebrow="Legal"
      title="Terms of Service"
      updated={UPDATED}
      intro={`The ground rules for shopping with ${storeName} — plain-language, and specific to how we actually operate (Cash on Delivery, Bangladesh-wide shipping).`}
      sections={sections}
    />
  );
}
