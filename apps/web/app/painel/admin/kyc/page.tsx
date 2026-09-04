import { requireStaff } from "@/lib/auth";
import { revisarKyc } from "./actions";

const URL_EXPIRACAO_SEGUNDOS = 60 * 5;

export default async function AdminKycPage() {
  const { supabase } = await requireStaff();

  const { data: pendentes } = await supabase
    .from("kyc_verificacoes")
    .select("id, provedor, documento_frente_url, selfie_url, criado_em, profile_id, profiles(nome_completo, documento)")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true });

  const comLinks = await Promise.all(
    (pendentes ?? []).map(async (v: any) => {
      const [documento, selfie] = await Promise.all([
        supabase.storage.from("kyc-documentos").createSignedUrl(v.documento_frente_url, URL_EXPIRACAO_SEGUNDOS),
        supabase.storage.from("kyc-documentos").createSignedUrl(v.selfie_url, URL_EXPIRACAO_SEGUNDOS),
      ]);
      return {
        ...v,
        documentoSignedUrl: documento.data?.signedUrl,
        selfieSignedUrl: selfie.data?.signedUrl,
      };
    })
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Verificações pendentes</h1>

      {comLinks.length === 0 && <p className="text-sm text-neutral-600">Nenhuma verificação pendente.</p>}

      <ul className="flex flex-col gap-4">
        {comLinks.map((v) => (
          <li key={v.id} className="rounded border p-4">
            <p className="font-medium">{v.profiles?.nome_completo}</p>
            <p className="text-sm text-neutral-600">Documento: {v.profiles?.documento}</p>
            <div className="mt-2 flex gap-3 text-sm">
              {v.documentoSignedUrl && (
                <a href={v.documentoSignedUrl} target="_blank" rel="noreferrer" className="underline">
                  Ver documento
                </a>
              )}
              {v.selfieSignedUrl && (
                <a href={v.selfieSignedUrl} target="_blank" rel="noreferrer" className="underline">
                  Ver selfie
                </a>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400">Link expira em 5 minutos.</p>

            <form action={revisarKyc} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={v.id} />
              <input
                name="motivo_reprovacao"
                placeholder="Motivo (se for reprovar)"
                className="rounded border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  name="decisao"
                  value="aprovado"
                  className="rounded bg-green-700 px-4 py-2 text-sm text-white"
                >
                  Aprovar
                </button>
                <button
                  name="decisao"
                  value="reprovado"
                  className="rounded bg-red-700 px-4 py-2 text-sm text-white"
                >
                  Reprovar
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
