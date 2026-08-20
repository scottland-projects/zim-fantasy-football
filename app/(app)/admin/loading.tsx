import { Skeleton, SkeletonNavTabs } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* TopBar */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-44 hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Tab nav */}
        <SkeletonNavTabs count={5} />

        {/* Overview stat cards — centred on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 flex flex-col items-center sm:items-start space-y-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Health + Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-card p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <div className="glass-card p-5 space-y-3">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                <Skeleton className="w-3 h-3 rounded shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Table — scrollable on mobile */}
        <div className="glass-card overflow-x-auto">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-24 rounded-xl" />
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
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-10 rounded-lg shrink-0" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-14 ml-auto" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
