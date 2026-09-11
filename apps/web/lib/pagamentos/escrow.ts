import { createAdminClient } from "@/lib/supabase/admin";
import { criarTransferencia, estornarPagamento } from "@/lib/pagarme/client";
import { calcularDivisaoDisputa } from "@/lib/pagamentos/divisao";

// Move o valor líquido da plataforma para o recipient_id do vendedor no
// Pagar.me — só quando a transferência de titularidade já foi confirmada (ou
// staff decide a disputa a favor do vendedor) é que o dinheiro sai de fato da
// conta da plataforma (docs/ARCHITECTURE.md §5.1). Roda sempre com
// service_role: quem dispara isso (comprador confirmando, ou staff numa
// disputa) não tem — nem deveria ter — permissão de RLS pra ler o
// pagarme_recipient_id do vendedor.
//
// Falha na transferência não é propagada como exceção: quem chama já mudou
// o status da transação/disputa e não deve desfazer isso por um problema do
// gateway — fica um evento em transacao_eventos para reconciliação manual.
export async function liberarEscrow(transacaoId: string, vendedorId: string, valorLiquido: number) {
  const admin = createAdminClient();

  const { data: vendedor } = await admin
    .from("profiles")
    .select("pagarme_recipient_id")
    .eq("id", vendedorId)
    .maybeSingle();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id")
    .eq("transacao_id", transacaoId)
    .eq("status", "confirmado")
    .maybeSingle();

  if (!vendedor?.pagarme_recipient_id || !pagamento) {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Liberação de escrow não disparada automaticamente: sem recipient_id ou pagamento confirmado.",
      status_novo: "concluida",
    });
    return;
  }

  try {
    await criarTransferencia({
      recipientId: vendedor.pagarme_recipient_id,
      valorCentavos: Math.round(valorLiquido * 100),
      referenciaExterna: transacaoId,
    });
    await admin
      .from("pagamentos")
      .update({ status: "liberado_vendedor", liberado_em: new Date().toISOString() })
      .eq("id", pagamento.id);
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Escrow liberado: valor líquido transferido ao vendedor no Pagar.me.",
      status_novo: "concluida",
    });
  } catch {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Falha ao transferir o escrow ao vendedor no Pagar.me — requer reconciliação manual.",
      status_novo: "concluida",
    });
  }
}

// Estorna o pagamento ao comprador — usado quando staff resolve uma disputa
// a favor dele. Como nunca houve split na cobrança, o estorno sai direto da
// conta da plataforma via cancelamento da charge, sem envolver o vendedor.
export async function estornarEscrow(transacaoId: string) {
  const admin = createAdminClient();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id, gateway_charge_id")
    .eq("transacao_id", transacaoId)
    .eq("status", "confirmado")
    .maybeSingle();

  if (!pagamento?.gateway_charge_id) {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Estorno não disparado automaticamente: sem pagamento confirmado com charge conhecida.",
      status_novo: "reembolsada",
    });
    return;
  }

  try {
    await estornarPagamento(pagamento.gateway_charge_id);
    await admin.from("pagamentos").update({ status: "estornado" }).eq("id", pagamento.id);
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Pagamento estornado ao comprador no Pagar.me.",
      status_novo: "reembolsada",
    });
  } catch {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Falha ao estornar o pagamento no Pagar.me — requer reconciliação manual.",
      status_novo: "reembolsada",
    });
  }
}

// Resolução de disputa por divisão: staff define o percentual do vendedor,
// o restante é devolvido ao comprador — nenhuma suposição sobre a posse da
// cota além do que staff já registrou na observação da disputa (ver
// docs/ARCHITECTURE.md §5.1, nota sobre o status 'dividida').
//
// `valorTotal` recebido aqui é o valor_acordado CHEIO (não
// valor_acordado - comissao_valor): decisão explícita de não cobrar
// comissão da plataforma numa divisão, pelo mesmo raciocínio do reembolso
// total (estornarEscrow) — sem uma venda que se completou de verdade, não
// há o que a plataforma cobrar. Revisar se o entendimento de negócio for
// "cobrar comissão proporcional sobre a parte liberada ao vendedor".
export async function dividirEscrow(transacaoId: string, vendedorId: string, valorTotal: number, percentualVendedor: number) {
  const admin = createAdminClient();

  const { valorVendedorCentavos, valorCompradorCentavos } = calcularDivisaoDisputa(
    Math.round(valorTotal * 100),
    percentualVendedor
  );

  const { data: vendedor } = await admin
    .from("profiles")
    .select("pagarme_recipient_id")
    .eq("id", vendedorId)
    .maybeSingle();

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id, gateway_charge_id")
    .eq("transacao_id", transacaoId)
    .eq("status", "confirmado")
    .maybeSingle();

  if (!pagamento?.gateway_charge_id) {
    await admin.from("transacao_eventos").insert({
      transacao_id: transacaoId,
      observacao: "Divisão não disparada automaticamente: sem pagamento confirmado com charge conhecida.",
      status_novo: "dividida",
    });
    return;
  }

  const falhas: string[] = [];

  if (valorVendedorCentavos > 0) {
    if (!vendedor?.pagarme_recipient_id) {
      falhas.push("vendedor sem recipient_id — parte dele não foi transferida.");
    } else {
      try {
        await criarTransferencia({
          recipientId: vendedor.pagarme_recipient_id,
          valorCentavos: valorVendedorCentavos,
          referenciaExterna: transacaoId,
        });
      } catch {
        falhas.push("falha ao transferir a parte do vendedor no Pagar.me.");
      }
    }
  }

  if (valorCompradorCentavos > 0) {
    try {
      await estornarPagamento(pagamento.gateway_charge_id, valorCompradorCentavos);
    } catch {
      falhas.push("falha ao estornar a parte do comprador no Pagar.me.");
    }
  }

  await admin.from("pagamentos").update({ status: "dividido" }).eq("id", pagamento.id);
  await admin.from("transacao_eventos").insert({
    transacao_id: transacaoId,
    observacao:
      falhas.length > 0
        ? `Divisão ${percentualVendedor}%/${100 - percentualVendedor}% processada com pendências: ${falhas.join(" ")} Requer reconciliação manual.`
        : `Disputa dividida: ${percentualVendedor}% ao vendedor, ${100 - percentualVendedor}% estornado ao comprador.`,
    status_novo: "dividida",
  });
}
