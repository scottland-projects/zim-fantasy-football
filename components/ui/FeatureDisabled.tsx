"use client";

import { PauseCircle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";

export function FeatureDisabled({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen">
      <TopBar title={title} subtitle="Temporarily unavailable" />
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 gap-4">
        <div className="p-3 rounded-2xl bg-slate-100/60 border border-slate-200">
          <PauseCircle className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl text-zff-black">{title} is taking a break</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
    </div>
  );
}
