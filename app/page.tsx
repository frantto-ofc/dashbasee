import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Dashboard
      user={{
        id: user.id,
        email: user.email ?? "Conta",
      }}
    />
  );
}
