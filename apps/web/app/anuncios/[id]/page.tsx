import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarProposta, abrirConversa } from "./actions";

const TIPO_BEM_LABEL: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  moto: "Moto",
  servico: "Serviço",
  pesados: "Pesados",
};

export default async function DetalheAnuncioPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string; sucesso?: string };
}) {
  const supabase = createClient();

  const { data: anuncio } = await supabase
    .from("anuncios")
    .select(
      "id, titulo, descricao, preco, aceita_proposta, vendedor_id, criado_em, " +
        "cotas(tipo_bem, valor_credito, saldo_devedor, valor_parcela, parcelas_pagas, parcelas_totais, contemplada, administradoras(nome)), " +
        "anuncio_midias(url, ordem), " +
        "profiles(nome_completo, reputacao_media, total_transacoes)"
    )
    .eq("id", params.id)
    .eq("status", "publicado")
    .maybeSingle<any>();

  if (!anuncio) notFound();

  const cota = anuncio.cotas;
  const vendedor = anuncio.profiles;
  const fotos = [...(anuncio.anuncio_midias ?? [])].sort((a: any, b: any) => a.ordem - b.ordem);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ehDono = user?.id === anuncio.vendedor_id;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">{anuncio.titulo}</h1>
      <p className="text-xl font-semibold text-neutral-900">
        {anuncio.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>

      {fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {fotos.map((f: any) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.url} src={f.url} alt={anuncio.titulo} className="h-40 w-56 flex-none rounded object-cover" />
          ))}
        </div>
      )}

      {anuncio.descricao && <p className="text-neutral-700">{anuncio.descricao}</p>}

      <dl className="grid grid-cols-2 gap-3 rounded border p-4 text-sm">
        <dt className="text-neutral-500">Administradora</dt>
        <dd>{cota?.administradoras?.nome}</dd>
        <dt className="text-neutral-500">Tipo de bem</dt>
        <dd>{TIPO_BEM_LABEL[cota?.tipo_bem]}</dd>
        <dt className="text-neutral-500">Valor do crédito</dt>
        <dd>{cota?.valor_credito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
        <dt className="text-neutral-500">Saldo devedor</dt>
        <dd>{cota?.saldo_devedor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
        <dt className="text-neutral-500">Parcela</dt>
        <dd>{cota?.valor_parcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
        <dt className="text-neutral-500">Parcelas pagas</dt>
        <dd>
          {cota?.parcelas_pagas} de {cota?.parcelas_totais}
        </dd>
        <dt className="text-neutral-500">Contemplada</dt>
        <dd>{cota?.contemplada ? "Sim" : "Não"}</dd>
      </dl>

      <div className="rounded border p-4 text-sm">
        <p className="font-medium">{vendedor?.nome_completo}</p>
        <p className="text-neutral-600">
          {vendedor?.total_transacoes > 0
            ? `${vendedor.reputacao_media.toFixed(1)} ★ (${vendedor.total_transacoes} negociações)`
            : "Vendedor ainda sem avaliações"}
        </p>
      </div>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}
      {searchParams.sucesso && (
        <p className="rounded bg-green-50 p-2 text-sm text-green-800">{searchParams.sucesso}</p>
      )}

      {ehDono ? (
        <p className="text-sm text-neutral-500">Este é o seu anúncio.</p>
      ) : (
        <>
          {user && (
            <form action={abrirConversa}>
              <input type="hidden" name="anuncio_id" value={anuncio.id} />
              <button type="submit" className="w-full rounded border py-2 text-sm">
                Falar com o vendedor
              </button>
            </form>
          )}
          <ComprarOuPropor anuncioId={anuncio.id} preco={anuncio.preco} aceitaProposta={anuncio.aceita_proposta} />
        </>
      )}
    </main>
  );
}

async function ComprarOuPropor({
  anuncioId,
  preco,
  aceitaProposta,
}: {
  anuncioId: string;
  preco: number;
  aceitaProposta: boolean;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <a href="/login" className="rounded bg-neutral-900 px-4 py-2 text-center text-white">
        Entre para propor ou comprar
      </a>
    );
  }

  return (
    <form action={criarProposta} className="flex flex-col gap-2 rounded border p-4">
      <input type="hidden" name="anuncio_id" value={anuncioId} />
      {aceitaProposta ? (
        <>
          <label className="text-sm">
            Sua proposta (R$)
            <input
              name="valor"
              inputMode="decimal"
              placeholder={preco.toString()}
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
            Enviar proposta
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="valor" value={preco} />
          <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
            Comprar por {preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </button>
        </>
      )}
    </form>
  );
}
