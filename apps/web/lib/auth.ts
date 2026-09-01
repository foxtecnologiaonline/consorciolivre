import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/completar-perfil");
  return { supabase, user, profile };
}

export async function requireStaff() {
  const { supabase, user, profile } = await requireProfile();
  if (profile.role !== "staff" && profile.role !== "admin") redirect("/painel");
  return { supabase, user, profile };
}
