import { cn } from "@/lib/utils";

/**
 * A loading placeholder that occupies the same space the real content will.
 * The point is not the shimmer — it's that the block reserves height, so the
 * page doesn't jump when the data lands (the charts were the worst offenders:
 * they collapsed to a one-line "Cargando..." and then snapped open to 250px).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}

/** Placeholder for a chart body — matches the charts' fixed 250px height. */
function ChartSkeleton() {
  return <Skeleton className="h-[250px] w-full" />;
}

/** Placeholder for a list of rows. */
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

export { ChartSkeleton, ListSkeleton, Skeleton };
