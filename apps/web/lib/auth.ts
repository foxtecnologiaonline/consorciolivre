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
  if (profile.suspenso) {
    // profiles.suspenso nunca era checado em lugar nenhum — se o soft-delete
    // do Supabase Auth (painel/conta/actions.ts) falhar ou demorar a
    // propagar, essa é a única coisa que impede a conta "excluída" de
    // continuar sendo usada normalmente.
    await supabase.auth.signOut();
    redirect("/login?erro=" + encodeURIComponent("Esta conta está suspensa ou foi excluída."));
  }
  return { supabase, user, profile };
}

export async function requireStaff() {
  const { supabase, user, profile } = await requireProfile();
  if (profile.role !== "staff" && profile.role !== "admin") redirect("/painel");
  return { supabase, user, profile };
}
