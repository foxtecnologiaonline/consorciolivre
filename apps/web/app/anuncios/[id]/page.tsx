import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TIPO_BEM_LABEL: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  moto: "Moto",
  servico: "Serviço",
  pesados: "Pesados",
};

export default async function DetalheAnuncioPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: anuncio } = await supabase
    .from("anuncios")
    .select(
      "id, titulo, descricao, preco, criado_em, cotas(tipo_bem, valor_credito, saldo_devedor, valor_parcela, parcelas_pagas, parcelas_totais, contemplada, administradoras(nome))"
    )
    .eq("id", params.id)
    .eq("status", "publicado")
    .maybeSingle<any>();

  if (!anuncio) notFound();

  const cota = anuncio.cotas;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">{anuncio.titulo}</h1>
      <p className="text-xl font-semibold text-neutral-900">
        {anuncio.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>

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

      <p className="text-xs text-neutral-500">
        Negociação e pagamento com escrow entram na próxima etapa do produto — por ora, entre em
        contato com o suporte para intermediar esta compra.
      </p>
    </main>
  );
}
