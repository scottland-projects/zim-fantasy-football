import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = "md", fullScreen }: LoadingSpinnerProps) {
  const sizeMap = { sm: "w-6 h-6", md: "w-10 h-10", lg: "w-16 h-16" };

  const spinner = (
    <div className="flex flex-col items-center gap-4">
      <div className={cn("relative", sizeMap[size])}>
        <div className={cn("absolute inset-0 rounded-full border-2 border-zff-green/20", sizeMap[size])} />
        <div className={cn("absolute inset-0 rounded-full border-2 border-transparent border-t-zff-green animate-spin", sizeMap[size])} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Star className={cn(size === "sm" ? "w-2 h-2" : size === "lg" ? "w-5 h-5" : "w-3 h-3", "text-zff-green")} />
        </div>
      </div>
      {size === "lg" && <p className="text-sm text-muted-foreground">Loading...</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}
