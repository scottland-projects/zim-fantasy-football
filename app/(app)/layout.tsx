import { Sidebar } from "@/components/layout/Sidebar";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@/lib/supabase/server");

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;
  let profile: { username: string; avatar_url: string | null; role: string; level: number; xp: number } | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    // Defence-in-depth: middleware already guards this, but catch any bypass here too
    if (!user) redirect("/login");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, avatar_url, role, level, xp")
      .eq("id", user.id)
      .single();
    profile = profileData;
  } catch (err: unknown) {
    // Re-throw redirect signals — Next.js uses them internally
    if (isRedirectError(err)) throw err;
    redirect("/login");
  }

  const isAdmin   = profile?.role === "admin";
  const isManager = profile?.role === "manager" || isAdmin;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        username={profile?.username ?? user?.email?.split("@")[0]}
        level={profile?.level ?? 1}
        xp={profile?.xp ?? 0}
        avatarUrl={profile?.avatar_url}
        isAdmin={isAdmin}
        isManager={isManager}
      />
      <main className="flex-1 min-w-0 min-h-screen lg:ml-64 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
