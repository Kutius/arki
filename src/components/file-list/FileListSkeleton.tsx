import { Skeleton } from "../ui/skeleton";

/** Deterministic pseudo-random width based on index. */
const treeWidths = [72, 58, 80, 65, 75, 60, 70, 68];
const rowWidths = [78, 65, 85, 70, 90, 60, 75, 82, 68, 73, 80, 62];

export function FileListSkeleton() {
  return (
    <div className="flex h-full flex-1">
      {/* Tree skeleton */}
      <div className="flex h-full w-52 flex-col border-r">
        <div className="flex h-9 items-center border-b px-3">
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex-1 p-2 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1" style={{ paddingLeft: `${8 + (i % 3) * 14}px` }}>
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-3" style={{ width: `${treeWidths[i]}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* File list skeleton */}
      <div className="flex h-full flex-col flex-1">
        {/* Breadcrumb skeleton */}
        <div className="flex h-9 items-center gap-1 border-b px-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Table header skeleton */}
        <div className="flex h-8 items-center border-b bg-muted/20 px-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="ml-8 h-3 w-24" />
        </div>

        {/* File rows skeleton */}
        <div className="flex-1 p-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[34px] items-center rounded-md px-3"
            >
              <Skeleton className="mr-2.5 h-4 w-4" />
              <Skeleton className="h-4 flex-1" style={{ width: `${rowWidths[i]}%` }} />
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="ml-8 h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
