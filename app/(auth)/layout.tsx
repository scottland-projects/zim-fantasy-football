"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Register has more fields (account + two security questions) than the
  // other auth pages — wide enough here to lay them out in two columns
  // instead of one long scroll, while login/forgot-password/reset-password
  // stay at the original, more compact width that suits their few fields.
  const isRegister = pathname === "/register";

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 bg-slate-50 relative overflow-hidden">
      {/* Stadium lights effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-zff-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zff-green/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 pitch-bg opacity-30" />
      </div>
      <div className={cn("relative z-10 w-full", isRegister ? "max-w-5xl" : "max-w-md")}>{children}</div>
    </div>
  );
}
