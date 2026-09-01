"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function toNumber(value: FormDataEntryValue | null) {
  return Number(String(value ?? "0").replace(",", "."));
}

export async function criarAnuncio(formData: FormData) {
  const { supabase, profile } = await requireProfile();

  if (profile.kyc_status !== "aprovado") {
    redirect("/painel/verificacao");
  }

  const cotaPayload = {
    vendedor_id: profile.id,
    administradora_id: String(formData.get("administradora_id") ?? ""),
    tipo_bem: String(formData.get("tipo_bem") ?? "veiculo") as
      | "imovel"
      | "veiculo"
      | "moto"
      | "servico"
      | "pesados",
    numero_grupo: String(formData.get("numero_grupo") ?? "").trim(),
    numero_cota: String(formData.get("numero_cota") ?? "").trim(),
    valor_credito: toNumber(formData.get("valor_credito")),
    saldo_devedor: toNumber(formData.get("saldo_devedor")),
    valor_parcela: toNumber(formData.get("valor_parcela")),
    parcelas_pagas: Number(formData.get("parcelas_pagas") ?? 0),
    parcelas_totais: Number(formData.get("parcelas_totais") ?? 0),
    contemplada: formData.get("contemplada") === "on",
  };

  if (!cotaPayload.administradora_id || !cotaPayload.numero_grupo || !cotaPayload.numero_cota) {
    redirect("/painel/anuncios/novo?erro=" + encodeURIComponent("Preencha os dados da cota."));
  }

  const { data: cota, error: erroCota } = await supabase
    .from("cotas")
    .insert(cotaPayload)
    .select("id")
    .single();

  if (erroCota || !cota) {
    redirect(`/painel/anuncios/novo?erro=${encodeURIComponent(erroCota?.message ?? "Erro ao salvar a cota.")}`);
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const preco = toNumber(formData.get("preco"));

  if (!titulo || !preco) {
    redirect("/painel/anuncios/novo?erro=" + encodeURIComponent("Preencha título e preço do anúncio."));
  }

  const { error: erroAnuncio } = await supabase.from("anuncios").insert({
    cota_id: cota!.id,
    vendedor_id: profile.id,
    titulo,
    descricao: descricao || null,
    preco,
  });

  if (erroAnuncio) {
    // Evita deixar uma cota órfã sem anúncio se o segundo insert falhar.
    await supabase.from("cotas").delete().eq("id", cota!.id);
    redirect(`/painel/anuncios/novo?erro=${encodeURIComponent(erroAnuncio.message)}`);
  }

  redirect("/painel/anuncios");
}
