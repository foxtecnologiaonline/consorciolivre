"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { elegibilidadeParaExclusao } from "@/lib/conta/exclusao";
import type { TransacaoStatus } from "@/lib/transacoes/state-machine";
import type { AnuncioStatus } from "@/lib/supabase/database.types";

const TRANSACAO_STATUS_NAO_TERMINAL: TransacaoStatus[] = [
  "aguardando_pagamento",
  "pagamento_em_escrow",
  "em_transferencia",
  "em_disputa",
];
const ANUNCIO_STATUS_ATIVO: AnuncioStatus[] = ["rascunho", "em_analise", "publicado", "pausado"];

// LGPD — direito à eliminação (docs/ARCHITECTURE.md §5.3). Nunca faz DELETE
// físico do profile: isso quebraria a FK de transacoes/avaliacoes/etc. já
// concluídas, que precisam continuar auditáveis. Em vez disso:
//   1. anonimiza os campos de identificação em profiles (nome/telefone/CPF-CNPJ)
//   2. apaga a conta bancária cadastrada (sem uso depois que a conta é encerrada)
//   3. soft-delete no Supabase Auth (desabilita login, mantém a linha em
//      auth.users para não quebrar a FK de profiles.id)
//
// kyc_verificacoes aprovada NÃO é apagada aqui: retenção de dado de KYC tem
// prazo legal próprio (prevenção a fraude/lavagem) que se sobrepõe ao pedido
// de eliminação — só o KYC reprovado tem expurgo automático (ver
// lib/kyc/expurgo.ts), que é dado sem essa obrigação de retenção.
export async function solicitarExclusaoConta(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  const confirmacao = String(formData.get("confirmacao") ?? "");
  if (confirmacao !== "EXCLUIR") {
    redirect("/painel/conta?erro=" + encodeURIComponent('Digite "EXCLUIR" para confirmar.'));
  }

  const [{ count: transacoesEmAndamento }, { count: anunciosAtivos }] = await Promise.all([
    supabase
      .from("transacoes")
      .select("id", { count: "exact", head: true })
      .or(`comprador_id.eq.${profile.id},vendedor_id.eq.${profile.id}`)
      .in("status", TRANSACAO_STATUS_NAO_TERMINAL),
    supabase
      .from("anuncios")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", profile.id)
      .in("status", ANUNCIO_STATUS_ATIVO),
  ]);

  const elegibilidade = elegibilidadeParaExclusao({
    transacoesEmAndamento: transacoesEmAndamento ?? 0,
    anunciosAtivos: anunciosAtivos ?? 0,
  });

  if (!elegibilidade.elegivel) {
    const mensagem =
      elegibilidade.motivo === "transacao_em_andamento"
        ? "Você tem transação em andamento. Finalize ou cancele antes de excluir a conta."
        : "Você tem anúncio ativo. Remova ou aguarde a venda/expiração antes de excluir a conta.";
    redirect(`/painel/conta?erro=${encodeURIComponent(mensagem)}`);
  }

  // profiles.suspenso é protegida por trigger (0005_pagarme_recebedor.sql) —
  // precisa de service_role, igual toda escrita nessa família de colunas.
  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({
      nome_completo: "Usuário removido",
      telefone: null,
      documento: `removido-${profile.id}`,
      suspenso: true,
    })
    .eq("id", profile.id);

  await admin.from("contas_bancarias").delete().eq("profile_id", profile.id);

  try {
    // shouldSoftDelete=true: desabilita o login sem apagar a linha em
    // auth.users (profiles.id referencia auth.users.id — apagar de verdade
    // quebraria a FK de tudo que esse usuário já transacionou). Não
    // verificado contra um projeto Supabase real neste ambiente — mesma
    // ressalva de "validar antes de produção" já registrada para o Pagar.me.
    await admin.auth.admin.deleteUser(profile.id, true);
  } catch {
    redirect(
      "/painel/conta?erro=" +
        encodeURIComponent(
          "Seus dados foram anonimizados, mas não foi possível desabilitar o login automaticamente. Contate o suporte."
        )
    );
  }

  await supabase.auth.signOut();
  redirect("/login?sucesso=" + encodeURIComponent("Sua conta foi excluída."));
}
