import { Skeleton, SkeletonNavTabs, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function LeaguesLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Weekly top 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-6 ml-auto" />
              </div>
            </div>
          ))}
        </div>

        <SkeletonNavTabs count={4} />

        {/* Table */}
        <div className="glass-card overflow-x-auto">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <Skeleton className="h-5 w-40" />
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-lg" />)}
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="px-4 py-3"><Skeleton className="h-3 w-14" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => <SkeletonTableRow key={i} cols={7} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


