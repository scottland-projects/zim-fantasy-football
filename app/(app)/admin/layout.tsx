// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@/lib/supabase/server");
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role: string } | null };

    if (profile?.role !== "admin") redirect("/dashboard");
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    redirect("/login");
  }

  return <>{children}</>;
}
