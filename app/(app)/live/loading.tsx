import { Skeleton } from "@/components/ui/Skeleton";

export default function LiveLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Score banner */}
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center space-y-2">
              <Skeleton className="h-3 w-12 mx-auto" />
              <Skeleton className="h-7 w-24 sm:w-36 mx-auto" />
            </div>
            <div className="text-center px-4 sm:px-8 space-y-2">
              <div className="flex items-center gap-4 justify-center">
                <Skeleton className="h-16 w-12" />
                <Skeleton className="h-8 w-6" />
                <Skeleton className="h-16 w-12" />
              </div>
              <Skeleton className="h-5 w-14 mx-auto rounded-full" />
            </div>
            <div className="flex-1 text-center space-y-2">
              <Skeleton className="h-3 w-12 mx-auto" />
              <Skeleton className="h-7 w-24 sm:w-36 mx-auto" />
            </div>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Events feed */}
          <div className="glass-card overflow-x-auto">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-7 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-4 w-8 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Live points */}
          <div className="glass-card overflow-x-auto">
            <div className="p-4 border-b border-slate-200">
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center py-4 border-b border-slate-100 space-y-2">
                <Skeleton className="h-3 w-24 mx-auto" />
                <Skeleton className="h-14 w-20 mx-auto" />
                <Skeleton className="h-3 w-28 mx-auto" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                    <Skeleton className="w-8 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-5 w-8" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Live leaderboard */}
          <div className="glass-card overflow-x-auto">
            <div className="p-4 border-b border-slate-200">
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-8 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


