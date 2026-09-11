import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  gerarCobrancaPix,
  gerarCobrancaBoleto,
  confirmarRecebimento,
  confirmarTransferencia,
  abrirDisputa,
  cancelarTransacao,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pagamento_em_escrow: "Pagamento confirmado — aguardando transferência",
  em_transferencia: "Em transferência na administradora",
  concluida: "Concluída",
  cancelada: "Cancelada",
  em_disputa: "Em disputa (aguardando análise da equipe)",
  reembolsada: "Reembolsada",
};

export default async function TransacaoDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string; sucesso?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const { data: transacao } = await supabase
    .from("transacoes")
    .select(
      "id, valor_acordado, comissao_percentual, comissao_valor, status, criado_em, comprador_id, vendedor_id, anuncios(titulo)"
    )
    .eq("id", params.id)
    .maybeSingle<any>();

  if (!transacao) notFound();

  const { data: eventos } = await supabase
    .from("transacao_eventos")
    .select("status_novo, observacao, criado_em")
    .eq("transacao_id", params.id)
    .order("criado_em", { ascending: true });

  const ehComprador = transacao.comprador_id === profile.id;
  const ehVendedor = transacao.vendedor_id === profile.id;
  const valorLiquidoVendedor = transacao.valor_acordado - transacao.comissao_valor;

  const { data: avaliacaoExistente } = await supabase
    .from("avaliacoes")
    .select("id")
    .eq("transacao_id", params.id)
    .eq("autor_id", profile.id)
    .maybeSingle();

  const { data: pagamentoPendente } = await supabase
    .from("pagamentos")
    .select("metodo, pix_qr_code, pix_qr_code_url, boleto_linha_digitavel, boleto_url, boleto_pdf_url, expira_em")
    .eq("transacao_id", params.id)
    .eq("status", "pendente")
    .maybeSingle();

  const { data: ultimoPagamento } = await supabase
    .from("pagamentos")
    .select("status")
    .eq("transacao_id", params.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cobrancaValida =
    pagamentoPendente?.expira_em && new Date(pagamentoPendente.expira_em) > new Date() ? pagamentoPendente : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">{transacao.anuncios?.titulo}</h1>
      <p className="text-sm text-neutral-600">Você é {ehComprador ? "o comprador" : "o vendedor"} nesta negociação.</p>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}
      {searchParams.sucesso && (
        <p className="rounded bg-green-50 p-2 text-sm text-green-800">{searchParams.sucesso}</p>
      )}

      <div className="rounded border p-4 text-sm">
        <p className="font-medium">{STATUS_LABEL[transacao.status]}</p>
        <dl className="mt-2 grid grid-cols-2 gap-1">
          <dt className="text-neutral-500">Valor acordado</dt>
          <dd>{transacao.valor_acordado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
          <dt className="text-neutral-500">Comissão da plataforma</dt>
          <dd>
            {transacao.comissao_percentual}% (
            {transacao.comissao_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
          </dd>
          {ehVendedor && (
            <>
              <dt className="text-neutral-500">Valor líquido a receber</dt>
              <dd>{valorLiquidoVendedor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-2 text-sm font-medium">Acompanhamento da negociação</h2>
        <p className="mb-3 text-xs text-neutral-500">
          O pagamento é feito via PIX direto na plataforma e fica retido em escrow até a
          transferência da cota ser confirmada. As demais etapas (transferência na
          administradora) são confirmadas manualmente pelas partes e ficam registradas abaixo
          para eventual disputa.
        </p>

        {transacao.status === "aguardando_pagamento" && ehComprador && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">1. Pague para colocar o valor em escrow.</p>
            {cobrancaValida?.metodo === "pix" && (
              <div className="rounded border border-dashed p-3 text-sm">
                {cobrancaValida.pix_qr_code_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cobrancaValida.pix_qr_code_url} alt="QR code PIX" className="mx-auto h-40 w-40" />
                )}
                <p className="mt-2 text-xs text-neutral-500">PIX copia e cola:</p>
                <code className="block break-all rounded bg-neutral-100 p-2 text-xs">{cobrancaValida.pix_qr_code}</code>
                <p className="mt-2 text-xs text-neutral-500">
                  Expira em {new Date(cobrancaValida.expira_em!).toLocaleString("pt-BR")}. A confirmação é automática
                  assim que o Pagar.me processar o pagamento.
                </p>
              </div>
            )}
            {cobrancaValida?.metodo === "boleto" && (
              <div className="rounded border border-dashed p-3 text-sm">
                <p className="text-xs text-neutral-500">Linha digitável:</p>
                <code className="block break-all rounded bg-neutral-100 p-2 text-xs">
                  {cobrancaValida.boleto_linha_digitavel}
                </code>
                {cobrancaValida.boleto_pdf_url && (
                  <a href={cobrancaValida.boleto_pdf_url} target="_blank" rel="noreferrer" className="mt-2 block underline">
                    Ver boleto em PDF
                  </a>
                )}
                <p className="mt-2 text-xs text-neutral-500">
                  Vence em {new Date(cobrancaValida.expira_em!).toLocaleDateString("pt-BR")}. A confirmação é
                  automática após a compensação (pode levar até 2 dias úteis).
                </p>
              </div>
            )}
            {!cobrancaValida && (
              <div className="flex gap-2">
                <form action={gerarCobrancaPix}>
                  <input type="hidden" name="id" value={transacao.id} />
                  <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Pagar com PIX</button>
                </form>
                <form action={gerarCobrancaBoleto}>
                  <input type="hidden" name="id" value={transacao.id} />
                  <button className="rounded border border-neutral-900 px-4 py-2 text-sm">Pagar com boleto</button>
                </form>
              </div>
            )}
            <form action={cancelarTransacao}>
              <input type="hidden" name="id" value={transacao.id} />
              <button className="text-sm text-red-700 underline">Cancelar negociação</button>
            </form>
          </div>
        )}
        {transacao.status === "aguardando_pagamento" && ehVendedor && (
          <p className="text-sm text-neutral-600">Aguardando o comprador pagar via PIX.</p>
        )}

        {transacao.status === "pagamento_em_escrow" && ehVendedor && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              2. Confirme o recebimento do pagamento e inicie a transferência da cota junto à
              administradora.
            </p>
            <form action={confirmarRecebimento}>
              <input type="hidden" name="id" value={transacao.id} />
              <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
                Confirmar recebimento e iniciar transferência
              </button>
            </form>
          </div>
        )}
        {transacao.status === "pagamento_em_escrow" && ehComprador && (
          <p className="text-sm text-neutral-600">
            Pagamento confirmado. Aguardando o vendedor iniciar a transferência da cota.
          </p>
        )}

        {transacao.status === "em_transferencia" && ehComprador && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">3. Confirme quando a administradora efetivar a cota no seu nome.</p>
            <form action={confirmarTransferencia}>
              <input type="hidden" name="id" value={transacao.id} />
              <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
                Transferência confirmada
              </button>
            </form>
          </div>
        )}
        {transacao.status === "em_transferencia" && ehVendedor && (
          <p className="text-sm text-neutral-600">
            Aguardando o comprador confirmar a transferência na administradora.
          </p>
        )}

        {(transacao.status === "pagamento_em_escrow" || transacao.status === "em_transferencia") && (
          <form action={abrirDisputa} className="mt-4 flex flex-col gap-2 border-t pt-3">
            <input type="hidden" name="id" value={transacao.id} />
            <input name="motivo" placeholder="Descreva o problema (opcional)" className="rounded border px-3 py-2 text-sm" />
            <button className="text-sm text-red-700 underline">Abrir disputa</button>
          </form>
        )}

        {transacao.status === "concluida" && ehVendedor && (
          <p className="text-sm text-neutral-600">
            {ultimoPagamento?.status === "liberado_vendedor"
              ? "Valor liberado para sua conta cadastrada no Pagar.me."
              : "Transação concluída — a liberação do valor para sua conta está sendo processada."}
          </p>
        )}

        {transacao.status === "concluida" && !avaliacaoExistente && (
          <Link href={`/painel/transacoes/${transacao.id}/avaliar`} className="text-sm underline">
            Avaliar esta negociação
          </Link>
        )}
        {transacao.status === "concluida" && avaliacaoExistente && (
          <p className="text-sm text-neutral-600">Você já avaliou esta negociação. Obrigado!</p>
        )}
        {transacao.status === "em_disputa" && (
          <p className="text-sm text-amber-700">
            Nossa equipe foi notificada e vai analisar as evidências para decidir a liberação.
          </p>
        )}
      </div>

      {eventos && eventos.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-600">Histórico</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {eventos.map((e, i) => (
              <li key={i} className="rounded border p-2">
                <span className="font-medium">{STATUS_LABEL[e.status_novo] ?? e.status_novo}</span> —{" "}
                {new Date(e.criado_em).toLocaleString("pt-BR")}
                {e.observacao && <p className="text-neutral-600">{e.observacao}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
