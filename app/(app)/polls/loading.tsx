import { Skeleton } from "@/components/ui/Skeleton";

export default function PollsLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-72 rounded-xl mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-6 space-y-3">
              <Skeleton className="h-5 w-4/5" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
