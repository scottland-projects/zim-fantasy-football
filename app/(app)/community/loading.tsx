import { Skeleton } from "@/components/ui/Skeleton";

export default function CommunityLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-36 hidden sm:block" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Single tab — polls only (matches live page state) */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>

        {/* Poll cards */}
        <div className="space-y-4 max-w-2xl">
          {[4, 3, 4].map((optionCount, i) => (
            <div key={i} className="glass-card p-5 sm:p-6 space-y-4">
              {/* Question */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>

              {/* Options with faux progress bars */}
              <div className="space-y-2.5">
                {Array.from({ length: optionCount }).map((_, j) => (
                  <div key={j} className="relative rounded-xl border border-slate-200 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-none rounded-l-xl animate-pulse bg-slate-200 opacity-40"
                      style={{ width: `${25 + j * 15}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3 px-4 py-3">
                      <Skeleton className="h-4 w-24 sm:w-32" />
                      <Skeleton className="h-4 w-8 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
