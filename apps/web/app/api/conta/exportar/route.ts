import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

// LGPD — portabilidade de dados (docs/ARCHITECTURE.md §5.3). Usa o client de
// sessão (nunca admin/service_role): a RLS de cada tabela já garante, por
// construção, que só voltam linhas do próprio usuário — não há lista de
// tabelas "permitidas" para manter sincronizada à mão.
export async function GET() {
  const { supabase, user, profile } = await requireProfile();

  const { data: cotas } = await supabase.from("cotas").select("*").eq("vendedor_id", user.id);
  const cotaIds = (cotas ?? []).map((c) => c.id);

  const [
    { data: kycVerificacoes },
    { data: titularidadeDocumentos },
    { data: anuncios },
    { data: propostasEnviadas },
    { data: transacoesComoComprador },
    { data: transacoesComoVendedor },
    { data: avaliacoesFeitas },
    { data: avaliacoesRecebidas },
    { data: mensagensEnviadas },
    { data: favoritos },
    { data: notificacoes },
  ] = await Promise.all([
    supabase
      .from("kyc_verificacoes")
      .select("id, provedor, status, motivo_reprovacao, criado_em, concluido_em")
      .eq("profile_id", user.id),
    cotaIds.length
      ? supabase.from("titularidade_documentos").select("id, cota_id, tipo, arquivo_url, validado, criado_em").in("cota_id", cotaIds)
      : Promise.resolve({ data: [] }),
    supabase.from("anuncios").select("*").eq("vendedor_id", user.id),
    supabase.from("propostas").select("*").eq("comprador_id", user.id),
    supabase.from("transacoes").select("*").eq("comprador_id", user.id),
    supabase.from("transacoes").select("*").eq("vendedor_id", user.id),
    supabase.from("avaliacoes").select("*").eq("autor_id", user.id),
    supabase.from("avaliacoes").select("*").eq("alvo_id", user.id),
    supabase.from("chat_mensagens").select("id, thread_id, conteudo, criado_em").eq("autor_id", user.id),
    supabase.from("favoritos").select("anuncio_id, criado_em").eq("profile_id", user.id),
    supabase.from("notificacoes").select("tipo, titulo, corpo, lida, criado_em").eq("profile_id", user.id),
  ]);

  const dados = {
    exportado_em: new Date().toISOString(),
    perfil: { ...profile, email: user.email },
    verificacoes_kyc: kycVerificacoes ?? [],
    cotas: cotas ?? [],
    documentos_titularidade: titularidadeDocumentos ?? [],
    anuncios: anuncios ?? [],
    propostas_enviadas: propostasEnviadas ?? [],
    transacoes_como_comprador: transacoesComoComprador ?? [],
    transacoes_como_vendedor: transacoesComoVendedor ?? [],
    avaliacoes_feitas: avaliacoesFeitas ?? [],
    avaliacoes_recebidas: avaliacoesRecebidas ?? [],
    mensagens_enviadas: mensagensEnviadas ?? [],
    favoritos: favoritos ?? [],
    notificacoes: notificacoes ?? [],
  };

  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="consorciolivre-meus-dados.json"',
    },
  });
}
