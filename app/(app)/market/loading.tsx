import { Skeleton } from "@/components/ui/Skeleton";

export default function MarketLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* TopBar */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-44 hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Top stat cards — centred on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 flex flex-col items-center sm:items-start space-y-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="glass-card p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Skeleton className="h-10 rounded-xl sm:flex-1" />
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-14 rounded-xl shrink-0" />
              ))}
            </div>
            <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
          </div>
        </div>

        {/* Mobile: vertical card list (matches real page) */}
        <div className="glass-card sm:hidden divide-y divide-slate-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-9 h-11 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-10 rounded" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
              <Skeleton className="h-8 w-14 rounded-xl shrink-0" />
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="glass-card hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#", "Player", "Pos", "Pts", "Price", "Goals", "Assists", "Action"].map(h => (
                  <th key={h} className="px-4 py-3">
                    <Skeleton className="h-3 w-12" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-4 py-3.5"><Skeleton className="h-3 w-6" /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-9 h-11 rounded-lg shrink-0" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><Skeleton className="h-5 w-10 mx-auto rounded" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-8 w-16 rounded-xl ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
