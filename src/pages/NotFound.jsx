import EmptyState from "../components/ui/EmptyState.jsx";

export default function NotFound() {
  return (
    <div className="min-h-screen pt-28 sm:pt-32">
      <EmptyState
        emoji="🫙"
        title="Page not found"
        message="This page seems to have evaporated. Let's get you back to your glowing routine."
        actionLabel="Return Home"
        onAction={() => (window.location.hash = "#/")}
      />
    </div>
  );
}
