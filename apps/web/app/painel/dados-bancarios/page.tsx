import { requireProfile } from "@/lib/auth";
import { cadastrarContaBancaria } from "./actions";

export default async function DadosBancariosPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const { data: contaBancaria } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Conta para receber pagamentos</h1>
      <p className="text-sm text-neutral-600">
        Cadastre a conta bancária onde você quer receber o valor das suas vendas. Ela é usada para
        criar seu recebedor no Pagar.me — sem isso não é possível publicar anúncio.
      </p>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      {profile.kyc_status !== "aprovado" && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Sua verificação de identidade precisa estar aprovada antes de cadastrar a conta bancária.
        </p>
      )}

      {profile.pagarme_recipient_id && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-800">
          Conta cadastrada e recebedor criado — você já pode publicar anúncios.
        </p>
      )}

      {profile.kyc_status === "aprovado" && (
        <form action={cadastrarContaBancaria} className="flex flex-col gap-3">
          <label className="text-sm">
            Código do banco
            <input
              type="text"
              name="banco_codigo"
              defaultValue={contaBancaria?.banco_codigo ?? ""}
              placeholder="341"
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              Agência
              <input
                type="text"
                name="agencia"
                defaultValue={contaBancaria?.agencia ?? ""}
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="w-20 text-sm">
              Dígito
              <input
                type="text"
                name="agencia_dv"
                defaultValue={contaBancaria?.agencia_dv ?? ""}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              Conta
              <input
                type="text"
                name="conta"
                defaultValue={contaBancaria?.conta ?? ""}
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="w-20 text-sm">
              Dígito
              <input
                type="text"
                name="conta_dv"
                defaultValue={contaBancaria?.conta_dv ?? ""}
                required
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
          </div>
          <label className="text-sm">
            Tipo de conta
            <select
              name="tipo_conta"
              defaultValue={contaBancaria?.tipo_conta ?? "corrente"}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Conta poupança</option>
            </select>
          </label>
          <p className="text-xs text-neutral-500">
            A conta precisa estar no nome de {profile.nome_completo} (mesmo CPF/CNPJ do cadastro).
          </p>
          <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
            {profile.pagarme_recipient_id ? "Atualizar conta bancária" : "Cadastrar conta bancária"}
          </button>
        </form>
      )}
    </main>
  );
}
