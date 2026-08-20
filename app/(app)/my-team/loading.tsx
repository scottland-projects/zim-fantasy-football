import { Skeleton, SkeletonPitchSlot } from "@/components/ui/Skeleton";

export default function MyTeamLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* TopBar */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-36 hidden sm:block" />
        </div>
        <div className="hidden sm:flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl sm:hidden" />
      </div>

      <div className="p-4 sm:p-6">
        {/* Budget bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5 sm:mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
              <Skeleton className="w-4 h-4 rounded shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 sm:w-20" />
                <Skeleton className="h-4 w-12 sm:w-16" />
              </div>
            </div>
          ))}
          <div className="sm:ml-auto">
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Pitch */}
          <div className="col-span-1 lg:col-span-2 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* FWD — 3 slots */}
              <div className="flex justify-center gap-2 sm:gap-3">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonPitchSlot key={i} />)}
              </div>
              {/* MID — 3 slots */}
              <div className="flex justify-center gap-2 sm:gap-3">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonPitchSlot key={i} />)}
              </div>
              {/* DEF — 4 slots: use smaller gap to fit on mobile */}
              <div className="flex justify-center gap-1.5 sm:gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonPitchSlot key={i} />)}
              </div>
              {/* GK */}
              <div className="flex justify-center">
                <SkeletonPitchSlot />
              </div>
            </div>
            {/* Bench */}
            <div className="border-t border-slate-200 p-3 sm:p-4 bg-slate-100/50">
              <Skeleton className="h-3 w-12 mx-auto mb-3" />
              <div className="flex justify-center gap-1.5 sm:gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonPitchSlot key={i} />)}
              </div>
            </div>
          </div>

          {/* Player list */}
          <div className="glass-card overflow-x-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-9 rounded-lg" />)}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-8 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-10 rounded-full" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-3.5 w-10" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="w-4 h-4 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
