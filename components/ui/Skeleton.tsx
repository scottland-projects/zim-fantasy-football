import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card p-5 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  const widths = ["w-8", "w-40", "w-20", "w-16", "w-16", "w-20", "w-16"];
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className={cn("h-4", widths[i] ?? "w-16")} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
      <Skeleton className="w-7 h-7 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-10 shrink-0" />
      <Skeleton className="h-5 w-14 shrink-0 hidden sm:block" />
      <Skeleton className="h-4 w-5 shrink-0 hidden sm:block" />
    </div>
  );
}

export function SkeletonPlayerCard() {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-16 h-20 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-10 rounded-full" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-3 mt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-2 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonPitchSlot() {
  return (
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="w-14 h-[4.5rem] sm:w-20 sm:h-24 rounded-xl" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="glass-card p-5 space-y-3 flex flex-col items-center sm:items-start">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonNavTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-xl shrink-0" />
      ))}
    </div>
  );
}

export function SkeletonChatMessage({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className={cn("flex gap-3", reverse && "flex-row-reverse")}>
      <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
      <div className={cn("space-y-1.5 min-w-0", reverse && "items-end flex flex-col")}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className={cn("h-10 rounded-xl", reverse ? "w-36 sm:w-48" : "w-48 sm:w-64")} />
      </div>
    </div>
  );
}
