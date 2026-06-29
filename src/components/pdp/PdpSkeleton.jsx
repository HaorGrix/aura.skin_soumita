import Skeleton from "../ui/Skeleton.jsx";

/** Loading skeleton matching the PDP layout (gallery + sticky info). */
export default function PdpSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 pt-28 sm:px-8 sm:pt-32">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="flex gap-4">
          <div className="hidden flex-col gap-3 lg:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-20" rounded="rounded-xl" />
            ))}
          </div>
          <Skeleton className="aspect-square flex-1" rounded="rounded-[1.5rem]" />
        </div>

        {/* Info */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" rounded="rounded-full" />
            ))}
          </div>
          <Skeleton className="h-20 w-full" rounded="rounded-xl" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-12 w-32" rounded="rounded-full" />
            <Skeleton className="h-12 flex-1" rounded="rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
