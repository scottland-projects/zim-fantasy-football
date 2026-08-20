import { Skeleton, SkeletonStat } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-40 hidden sm:block" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Profile hero */}
        <div className="glass-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            <div className="relative shrink-0 self-center sm:self-auto">
              <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl" />
              <Skeleton className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl" />
            </div>
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <Skeleton className="h-6 sm:h-7 w-40 sm:w-44 max-w-full" />
                  <Skeleton className="h-4 w-28" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <Skeleton className="h-3 w-32 sm:w-36" />
                    <Skeleton className="h-3 w-24 sm:w-28" />
                  </div>
                  <Skeleton className="h-3 w-full sm:w-80" />
                </div>
                <Skeleton className="h-8 sm:h-9 w-24 sm:w-28 rounded-xl shrink-0" />
              </div>
              {/* XP bar */}
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-36 sm:w-40" />
                    <Skeleton className="h-3 w-16 sm:w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart */}
          <div className="col-span-1 lg:col-span-2 glass-card p-5 space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-44 sm:h-52 w-full rounded-xl" />
          </div>

          {/* Trophy cabinet */}
          <div className="glass-card p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements grid */}
        <div className="glass-card p-5">
          <Skeleton className="h-6 w-44 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 sm:p-4 rounded-xl border border-slate-100 text-center space-y-2">
                <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl mx-auto" />
                <Skeleton className="h-3.5 w-16 sm:w-20 mx-auto" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
