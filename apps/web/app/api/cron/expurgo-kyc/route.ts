import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autenticadoCron, dataLimiteRetencao } from "@/lib/kyc/expurgo";

// Política de retenção documentada em docs/ARCHITECTURE.md §5.3: dados de
// KYC reprovado são apagados após um prazo definido — aqui, 90 dias após a
// reprovação (tempo suficiente para o usuário reenviar/contestar antes do
// documento desaparecer). Agendado via Vercel Cron (vercel.json), protegido
// por CRON_SECRET (Vercel injeta `Authorization: Bearer $CRON_SECRET`
// automaticamente nas chamadas que ele mesmo dispara).
const DIAS_RETENCAO_KYC_REPROVADO = 90;

export async function GET(request: NextRequest) {
  if (!autenticadoCron(request.headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const limite = dataLimiteRetencao(DIAS_RETENCAO_KYC_REPROVADO);

  const { data: verificacoes } = await admin
    .from("kyc_verificacoes")
    .select("id, documento_frente_url, documento_verso_url, selfie_url")
    .eq("status", "reprovado")
    .lt("concluido_em", limite);

  if (!verificacoes || verificacoes.length === 0) {
    return NextResponse.json({ ok: true, removidas: 0 });
  }

  const caminhos = verificacoes
    .flatMap((v) => [v.documento_frente_url, v.documento_verso_url, v.selfie_url])
    .filter((caminho): caminho is string => Boolean(caminho));

  if (caminhos.length > 0) {
    await admin.storage.from("kyc-documentos").remove(caminhos);
  }

  await admin
    .from("kyc_verificacoes")
    .delete()
    .in("id", verificacoes.map((v) => v.id));

  return NextResponse.json({ ok: true, removidas: verificacoes.length });
}
