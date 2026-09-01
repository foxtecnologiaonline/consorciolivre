import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { salvarPerfil } from "./actions";

export default async function CompletarPerfilPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/painel");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Complete seu cadastro</h1>
      <p className="text-sm text-neutral-600">
        Precisamos desses dados antes de você navegar como comprador ou vendedor verificado.
      </p>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      <form action={salvarPerfil} className="flex flex-col gap-3">
        <fieldset className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" name="tipo_pessoa" value="pf" defaultChecked /> Pessoa física
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="tipo_pessoa" value="pj" /> Pessoa jurídica
          </label>
        </fieldset>

        <input
          name="nome_completo"
          placeholder="Nome completo ou razão social"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="documento"
          placeholder="CPF ou CNPJ (apenas números)"
          required
          className="rounded border px-3 py-2"
        />
        <input name="telefone" placeholder="Telefone (opcional)" className="rounded border px-3 py-2" />

        <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
          Salvar e continuar
        </button>
      </form>
    </main>
  );
}
