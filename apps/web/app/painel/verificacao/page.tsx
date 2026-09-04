import { requireProfile } from "@/lib/auth";
import { solicitarVerificacao } from "./actions";

export default async function VerificacaoPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const { data: verificacoes } = await supabase
    .from("kyc_verificacoes")
    .select("*")
    .eq("profile_id", profile.id)
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Verificação de identidade</h1>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      {profile.kyc_status === "aprovado" && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-800">
          Sua conta está verificada. Você já pode publicar anúncios.
        </p>
      )}

      {profile.kyc_status === "em_analise" && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Sua verificação está em análise. Nossa equipe confere o documento em até 2 dias úteis.
        </p>
      )}

      {(profile.kyc_status === "pendente" || profile.kyc_status === "reprovado") && (
        <>
          {profile.kyc_status === "reprovado" && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-700">
              Sua última verificação foi reprovada. Envie os documentos novamente.
            </p>
          )}
          <form action={solicitarVerificacao} className="flex flex-col gap-3">
            <label className="text-sm">
              Documento oficial com foto (frente)
              <input
                type="file"
                name="documento_frente"
                accept="image/*,.pdf"
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Selfie segurando o documento
              <input
                type="file"
                name="selfie"
                accept="image/*"
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <p className="text-xs text-neutral-500">
              Os arquivos ficam num bucket privado — só você e a equipe de verificação têm acesso.
            </p>
            <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
              Enviar para análise
            </button>
          </form>
        </>
      )}

      {verificacoes && verificacoes.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-600">Histórico</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {verificacoes.map((v) => (
              <li key={v.id} className="rounded border p-2">
                {v.status} — {new Date(v.criado_em).toLocaleDateString("pt-BR")}
                {v.motivo_reprovacao && <p className="text-red-700">{v.motivo_reprovacao}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
