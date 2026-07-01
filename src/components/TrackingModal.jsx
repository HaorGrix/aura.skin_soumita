import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Truck, MapPin, CheckCircle, Clock } from "lucide-react";
import Button from "./ui/Button.jsx";
import { formatPrice } from "../lib/format.js";

/**
 * TrackingModal — Order status tracker with 4-stage progress.
 *
 * Stages: Order Confirmed → Processing → Out for Delivery → Delivered
 * Status progresses based on time since order (mocked).
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   orderData: {
 *     number: string (e.g., "AUR-123456"),
 *     count: number (item count),
 *     total: number (price in USD),
 *     timestamp: string (ISO date, e.g., "2024-01-15T10:30:00Z"),
 *     trackingNumber?: string (optional carrier tracking #),
 *     date?: string (YYYY-MM-DD format, used for display)
 *   }
 */
export default function TrackingModal({ isOpen, onClose, orderData }) {
  if (!orderData) return null;

  // Mock status progression based on hours since order was placed
  const getOrderStatus = () => {
    const createdAt = new Date(orderData.timestamp || Date.now());
    const now = new Date();
    const hoursPassed = (now - createdAt) / (1000 * 60 * 60);

    // Timeline: 0–0.5h → confirmed, 0.5–24h → processing, 24–48h → out-for-delivery, 48h+ → delivered
    if (hoursPassed < 0.5) return "confirmed";
    if (hoursPassed < 24) return "processing";
    if (hoursPassed < 48) return "out-for-delivery";
    return "delivered";
  };

  // Format order date for display
  const formatOrderDate = () => {
    if (orderData.date) {
      return new Date(orderData.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    if (orderData.timestamp) {
      return new Date(orderData.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const status = getOrderStatus();

  const stages = [
    {
      id: "confirmed",
      label: "Order Confirmed",
      icon: CheckCircle,
      desc: "Your order has been received",
    },
    {
      id: "processing",
      label: "Processing",
      icon: Package,
      desc: "Preparing your items",
    },
    {
      id: "out-for-delivery",
      label: "Out for Delivery",
      icon: Truck,
      desc: "On its way to you",
    },
    {
      id: "delivered",
      label: "Delivered",
      icon: MapPin,
      desc: "Delivered to your address",
    },
  ];

  const currentStageIndex = stages.findIndex((s) => s.id === status);
  const isDelivered = status === "delivered";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[var(--z-modal)] bg-ink/60 backdrop-blur-sm p-4 sm:p-10 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-[1.75rem] bg-white p-8 text-center shadow-lift ring-1 ring-line dark:bg-[#0f0f12] dark:ring-white/10 sm:p-10"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl text-ink dark:text-white">
                Order Tracking
              </h2>
              <button
                onClick={onClose}
                aria-label="Close tracking modal"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-snow hover:text-magenta dark:text-white/60 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>

            {/* Order Number */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-sm text-ink-soft dark:text-white/60">Order Number</p>
              <p className="font-serif text-xl text-magenta dark:text-rose mt-1">
                {orderData.number}
              </p>
              <p className="text-xs text-ink-soft dark:text-white/50 mt-1">
                {formatOrderDate()}
              </p>
            </motion.div>

            {/* Progress Timeline */}
            <motion.div
              className="mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Stage Timeline Container */}
              <div className="relative px-4">
                {/* Background line */}
                <div className="absolute top-8 left-4 right-4 h-1 bg-line dark:bg-white/10" />

                {/* Filled progress line (animates as stages complete) */}
                <motion.div
                  className="absolute top-8 left-4 h-1 bg-gradient-to-r from-magenta to-rose"
                  initial={{ width: 0 }}
                  animate={{
                    width: `calc(100% - 2rem * (4 - ${currentStageIndex + 1}) / 3)`,
                  }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />

                {/* Stage circles and labels */}
                <div className="relative flex justify-between">
                  {stages.map((stage, idx) => {
                    const isActive = idx === currentStageIndex;
                    const isDone = idx < currentStageIndex;
                    const Icon = stage.icon;

                    return (
                      <motion.div
                        key={stage.id}
                        className="flex flex-col items-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                      >
                        {/* Circle */}
                        <motion.div
                          className={`h-16 w-16 rounded-full flex items-center justify-center ring-4 transition-all ${
                            isDone || isActive
                              ? "bg-magenta text-white ring-magenta/30 shadow-[var(--shadow-glow-pink)]"
                              : "bg-white text-ink-soft ring-line dark:bg-white/5 dark:ring-white/10 dark:text-white/40"
                          }`}
                          animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "easeInOut",
                          }}
                        >
                          <Icon
                            className={`h-6 w-6 ${isActive ? "animate-pulse" : ""}`}
                            strokeWidth={2}
                          />
                        </motion.div>

                        {/* Label */}
                        <p
                          className={`mt-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
                            isDone || isActive
                              ? "text-magenta dark:text-rose"
                              : "text-ink-soft dark:text-white/40"
                          }`}
                        >
                          {stage.label}
                        </p>

                        {/* Description */}
                        <p
                          className={`mt-1 text-xs leading-snug transition-colors ${
                            isDone || isActive
                              ? "text-ink dark:text-white"
                              : "text-ink-soft dark:text-white/50"
                          }`}
                        >
                          {stage.desc}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Status Message Card */}
            <motion.div
              className="mb-8 rounded-2xl bg-petal/30 p-4 ring-1 ring-rose/30 dark:bg-white/5 dark:ring-white/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-magenta flex-shrink-0" strokeWidth={2} />
                <p className="text-sm font-medium text-ink dark:text-white">
                  {isDelivered
                    ? "✨ Your order has been delivered! Thank you for glowing with us."
                    : "Your order is on its way. We'll keep you updated."}
                </p>
              </div>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              className="rounded-2xl bg-snow p-5 ring-1 ring-line dark:bg-white/[0.04] dark:ring-white/10 text-left mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="font-semibold text-ink dark:text-white mb-4">
                Order Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft dark:text-white/60">Number of Items</span>
                  <span className="font-medium text-ink dark:text-white">
                    {orderData.count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft dark:text-white/60">Total Amount</span>
                  <span className="font-serif text-base font-medium text-magenta dark:text-rose">
                    {formatPrice(orderData.total)}
                  </span>
                </div>
                {orderData.trackingNumber && (
                  <>
                    <div className="my-3 h-px bg-line dark:bg-white/10" />
                    <div className="flex justify-between pt-2">
                      <span className="text-ink-soft dark:text-white/60">
                        Tracking Number
                      </span>
                      <span className="font-mono text-xs font-semibold text-magenta dark:text-rose">
                        {orderData.trackingNumber}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Close Button */}
            <Button
              variant="primary"
              onClick={onClose}
              className="w-full"
              magnetic={false}
            >
              Close Tracking
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
