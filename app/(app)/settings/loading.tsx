import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-44 hidden sm:block" />
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl space-y-5">
        {/* Notification Preferences */}
        <div className="glass-card p-5 sm:p-7 space-y-4">
          <Skeleton className="h-5 w-52" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48 hidden sm:block" />
              </div>
              <Skeleton className="w-11 h-6 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        {/* Display Preferences */}
        <div className="glass-card p-5 sm:p-7 space-y-4">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44 hidden sm:block" />
              </div>
              <Skeleton className="w-11 h-6 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        {/* Account Security */}
        <div className="glass-card p-5 sm:p-7 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  );
}
