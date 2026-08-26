import { Skeleton, SkeletonChatMessage } from "@/components/ui/Skeleton";

export default function ChatLoading() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
        <div className="glass-card p-5 space-y-5">
          <SkeletonChatMessage />
          <SkeletonChatMessage reverse />
          <SkeletonChatMessage />
          <SkeletonChatMessage />
          <SkeletonChatMessage reverse />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
