/**
 * Skeleton — shimmering placeholder. Compose freely, or use the prebuilt
 * <ProductCardSkeleton /> for loading product grids.
 */
export default function Skeleton({ className = "", rounded = "rounded-lg" }) {
  return <div className={`shimmer ${rounded} ${className}`} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[4/5] w-full" rounded="rounded-[1.25rem]" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}
