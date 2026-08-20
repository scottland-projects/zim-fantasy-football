import { Skeleton, SkeletonStat, SkeletonLeaderboardRow } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* TopBar skeleton */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Skeleton className="h-9 w-52 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Leaderboard */}
          <div className="col-span-1 lg:col-span-2 glass-card p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonLeaderboardRow key={i} />)}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-20 mx-auto" />
                </div>
              ))}
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>

            <div className="glass-card p-5 space-y-3">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="w-4 h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity row */}
        <div className="glass-card p-5">
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


