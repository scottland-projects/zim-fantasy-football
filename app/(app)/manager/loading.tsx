import { Skeleton } from "@/components/ui/Skeleton";

export default function ManagerLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-48 hidden sm:block" />
        </div>
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Tabs — flex-1 on mobile like the real tabs */}
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 sm:w-44 sm:flex-none rounded-xl" />
          <Skeleton className="h-10 flex-1 sm:w-32 sm:flex-none rounded-xl" />
        </div>

        <div className="glass-card overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-28 rounded-xl shrink-0" />
          </div>

          {/* Mobile: simplified rows */}
          <div className="sm:hidden divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3">
                <div className="w-14 shrink-0 space-y-1">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-2.5 w-10" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-8 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <Skeleton className="h-7 w-14 rounded-lg shrink-0" />
              </div>
            ))}
          </div>

          {/* Desktop: full rows */}
          <div className="hidden sm:block divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-24 shrink-0 space-y-1">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <div className="flex-1 flex items-center justify-center gap-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <Skeleton className="h-6 w-20 rounded-lg shrink-0" />
                <Skeleton className="h-7 w-24 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
