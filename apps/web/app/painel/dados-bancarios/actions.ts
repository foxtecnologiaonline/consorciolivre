"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PagarmeError, criarRecebedor, type TipoContaPagarme } from "@/lib/pagarme/client";

export async function cadastrarContaBancaria(formData: FormData) {
  const { supabase, user, profile } = await requireProfile();

  if (profile.kyc_status !== "aprovado") {
    redirect("/painel/verificacao");
  }
  if (!user.email) {
    redirect(
      "/painel/dados-bancarios?erro=" +
        encodeURIComponent("Sua conta precisa de um e-mail cadastrado para receber pagamentos.")
    );
  }

  const bancoCodigo = String(formData.get("banco_codigo") ?? "").trim();
  const agencia = String(formData.get("agencia") ?? "").trim();
  const agenciaDv = String(formData.get("agencia_dv") ?? "").trim();
  const conta = String(formData.get("conta") ?? "").trim();
  const contaDv = String(formData.get("conta_dv") ?? "").trim();
  const tipoConta = String(formData.get("tipo_conta") ?? "") as "corrente" | "poupanca";

  if (!bancoCodigo || !agencia || !conta || !contaDv || !["corrente", "poupanca"].includes(tipoConta)) {
    redirect("/painel/dados-bancarios?erro=" + encodeURIComponent("Preencha todos os campos da conta bancária."));
  }

  const tipoContaPagarme: TipoContaPagarme = tipoConta === "corrente" ? "checking" : "savings";

  let recipientId: string;
  try {
    const resultado = await criarRecebedor(
      {
        nome: profile.nome_completo,
        email: user.email,
        documento: profile.documento,
        tipoPessoa: profile.tipo_pessoa === "pf" ? "individual" : "company",
      },
      {
        bancoCodigo,
        agencia,
        agenciaDv: agenciaDv || undefined,
        conta,
        contaDv,
        tipoConta: tipoContaPagarme,
      }
    );
    recipientId = resultado.id;
  } catch (erro) {
    const mensagem =
      erro instanceof PagarmeError
        ? "Não foi possível validar a conta bancária com o gateway de pagamento. Confira os dados e tente novamente."
        : "Erro inesperado ao cadastrar a conta bancária.";
    redirect(`/painel/dados-bancarios?erro=${encodeURIComponent(mensagem)}`);
  }

  const { error: erroConta } = await supabase.from("contas_bancarias").upsert(
    {
      profile_id: profile.id,
      banco_codigo: bancoCodigo,
      agencia,
      agencia_dv: agenciaDv || null,
      conta,
      conta_dv: contaDv,
      tipo_conta: tipoConta,
    },
    { onConflict: "profile_id" }
  );

  if (erroConta) {
    redirect(`/painel/dados-bancarios?erro=${encodeURIComponent(erroConta.message)}`);
  }

  // profiles.pagarme_recipient_id é protegida por trigger (0005_pagarme_recebedor.sql)
  // contra escrita direta do usuário — só o client com service_role pode gravá-la,
  // e só depois que o Pagar.me já confirmou a criação do recebedor acima.
  const admin = createAdminClient();
  const { error: erroPerfil } = await admin
    .from("profiles")
    .update({ pagarme_recipient_id: recipientId })
    .eq("id", profile.id);

  if (erroPerfil) {
    redirect(`/painel/dados-bancarios?erro=${encodeURIComponent(erroPerfil.message)}`);
  }

  redirect("/painel/anuncios/novo");
}
