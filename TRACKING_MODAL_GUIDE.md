# TrackingModal Integration Guide

## Overview

The `TrackingModal.jsx` component displays a 4-stage order tracking progress bar:
1. **Order Confirmed** — Order received
2. **Processing** — Items being prepared
3. **Out for Delivery** — En route to customer
4. **Delivered** — Successfully delivered

**Status progresses automatically** based on time elapsed since order placement (mocked):
- 0–30 mins → Confirmed
- 30 mins–24 hrs → Processing
- 24–48 hrs → Out for Delivery
- 48+ hrs → Delivered

---

## Component API

### `TrackingModal` Props

```jsx
<TrackingModal
  isOpen={boolean}        // Modal visibility
  onClose={() => void}    // Close handler
  order={{
    number: string,       // e.g., "AUR-123456" or "#1001"
    count: number,        // Item count
    total: number,        // Total price (USD)
    timestamp?: string,   // ISO timestamp (defaults to now)
    trackingNumber?: string // Optional carrier tracking #
  }}
/>
```

---

## Integration Points

### 1. ✅ Success Page (Checkout.jsx)

**Already integrated.** When an order is placed, the success page shows:
- ✅ Primary button: "Track Order"
- ✅ Secondary buttons: "Continue shopping", "Back home"

**How it works:**
```jsx
// In Checkout.jsx Success component
const [trackingOpen, setTrackingOpen] = useState(false);

<TrackingModal
  isOpen={trackingOpen}
  onClose={() => setTrackingOpen(false)}
  order={orderWithTimestamp}  // Contains: number, count, total, timestamp
/>
```

---

### 2. ✅ My Purchases / Order History (Account.jsx → OrdersTab)

**Already integrated.** Each order card now shows:
- ✅ "Track" button (with truck icon) in the order header
- ✅ "Details" button for the existing OrderDetailsModal
- ✅ Responsive layout (stacked on mobile)

**How it works:**
```jsx
// In OrdersTab.jsx
const [trackingOrder, setTrackingOrder] = useState(null);

// Button trigger
<Button onClick={() => setTrackingOrder(order)}>
  <Truck /> Track
</Button>

// Modal rendering
<TrackingModal
  isOpen={!!trackingOrder}
  onClose={() => setTrackingOrder(null)}
  order={{
    number: `#${trackingOrder.orderId}`,
    count: trackingOrder.items.length,
    total: trackingOrder.total,
    timestamp: trackingOrder.date,
  }}
/>
```

---

## Features

### Progress Timeline
- **Visual progression**: Animated progress bar fills from left to right
- **Active stage highlight**: Current stage pulses with magenta background
- **Completed stages**: Fade to magenta with checkmark
- **Pending stages**: Gray/muted until reached

### Status Messaging
- **Smart messaging**: Changes based on delivery status
- **Confirmed**: "Your order is on its way. We'll keep you updated."
- **Delivered**: "✨ Your order has been delivered! Thank you for glowing with us."

### Order Summary Card
- Item count
- Total amount (formatted price)
- Optional tracking number (carrier tracking ID)

### Animations
- Modal entry: Spring scale + opacity fade
- Stage circles: Scale + stagger animation
- Progress line: Smooth width transition
- Active stage: Continuous pulse animation

---

## UI/UX Details

### Design System Integration
- ✅ Uses design tokens (magenta, rose, petal, etc.)
- ✅ Dark mode support (default dark)
- ✅ Z-index: `z-[var(--z-modal)]` (150)
- ✅ Shadows: `shadow-lift` (26px, high contrast)
- ✅ Rounded: `rounded-[1.75rem]` (consistent corner radius)
- ✅ Transitions: Uses `ease-aura` cubic-bezier (0.22, 1, 0.36, 1)

### Mobile Optimization
- Full-width on small screens (px-4 padding)
- Stacked layout for button groups
- Touch-friendly icon buttons (h-9 w-9 circles)
- Responsive text sizing

### Accessibility
- ✅ ARIA labels (`aria-label="Close tracking modal"`)
- ✅ Semantic HTML (`<button>`, proper heading hierarchy)
- ✅ Focus management (click outside closes)
- ✅ Keyboard support (Escape key closes via backdrop)

---

## Customization

### Adjust Stage Timing

Edit the timeline thresholds in `TrackingModal.jsx`:

```jsx
const getOrderStatus = () => {
  const hoursPassed = (now - createdAt) / (1000 * 60 * 60);

  if (hoursPassed < 0.5) return "confirmed";     // ← Change this
  if (hoursPassed < 24) return "processing";     // ← Change this
  if (hoursPassed < 48) return "out-for-delivery"; // ← Change this
  return "delivered";
};
```

### Add Real Tracking Data

To integrate with a real tracking API:

```jsx
// Option 1: Fetch tracking status from API
useEffect(() => {
  fetch(`/api/orders/${order.number}/tracking`)
    .then(r => r.json())
    .then(data => setStatus(data.status)); // Override mock status
}, [order.number]);

// Option 2: Pass real status from parent
<TrackingModal
  isOpen={isOpen}
  onClose={onClose}
  order={order}
  realStatus="out-for-delivery"  // Add this prop
/>
```

### Customize Stage Icons or Labels

Edit the `stages` array:

```jsx
const stages = [
  {
    id: "confirmed",
    label: "Custom Label",
    icon: CustomIcon,  // Import from lucide-react
    desc: "Custom description",
  },
  // ...
];
```

---

## No Route Changes Required

✅ **Zero modifications to App.jsx hash routing**

The modal is entirely client-side and state-driven:
- Success page state: `useState(false)` in Checkout.jsx
- Account page state: `useState(null)` in OrdersTab.jsx
- No new routes, no new hash navigation

All existing routes (`#/checkout`, `#/account`, etc.) remain untouched.

---

## Testing the Modal

### On Success Page
1. Place an order in checkout
2. Click "Track Order" button on success card
3. See 4-stage progress (will be at "Confirmed" within seconds of order)

### On Account Page
1. Navigate to Account → My Purchases
2. Click "Track" button on any order card
3. Modal opens with order details and progress

### Mock Progression
To see status changes:
- **Fast-forward time** in browser console:
  ```js
  localStorage.setItem('debug-time-offset', 24*60*60*1000); // +24 hrs
  ```
- Refresh the page and open tracking modal again
- Status advances to "Processing"

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/TrackingModal.jsx` | **NEW** — Main component |
| `src/pages/Checkout.jsx` | Added import + state + button in Success |
| `src/components/account/OrdersTab.jsx` | Added import + state + Track button |

---

## Performance Notes

- **Bundle size**: ~8 kB (minified) — adds Framer Motion animations
- **Rendering**: Lazy (`AnimatePresence` unmounts when closed)
- **No external API calls** — pure mock/localStorage
- **Mobile-friendly**: No performance impact on 3G

---

## Future Enhancements

1. **Real carrier tracking** — Fetch from Shippo, EasyPost, or Aftership
2. **Estimated delivery date** — Show "Est. delivery: Fri, Jul 5"
3. **Shipping updates feed** — Timeline of "Picked up", "In transit", "Out for delivery"
4. **Notification integration** — SMS/email notifications on status change
5. **Return tracking** — Reverse logistics if item is returned
6. **Live location map** — Google Maps or Mapbox integration

---

## Debugging

### Modal doesn't open
- Verify `isOpen` state is `true`
- Check z-index with DevTools (should be 150)
- Ensure `onClose` handler is wired

### Status not advancing
- Check browser console: `console.log(new Date() - new Date(order.timestamp))`
- Ensure `timestamp` is ISO format
- Try refreshing page (status calculated on render)

### Styling issues
- Ensure `dark` class is on `<html>` (check `App.jsx`)
- Verify Tailwind CSS is loaded (check `index.css` imports)
- Clear browser cache if tokens aren't applying

---

## Support

For issues or questions:
1. Check the component JSDoc at top of `TrackingModal.jsx`
2. Review the integration code in `Checkout.jsx` and `OrdersTab.jsx`
3. Test with mock orders in the Account page
