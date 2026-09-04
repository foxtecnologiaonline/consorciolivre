import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { criarAnuncio } from "./actions";

export default async function NovoAnuncioPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const { supabase, profile } = await requireProfile();

  if (profile.kyc_status !== "aprovado") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Verificação necessária</h1>
        <p className="text-sm text-neutral-600">
          Só usuários com identidade verificada podem publicar anúncios de venda.
        </p>
        <Link href="/painel/verificacao" className="rounded bg-neutral-900 py-2 text-white">
          Solicitar verificação
        </Link>
      </main>
    );
  }

  const { data: administradoras } = await supabase
    .from("administradoras")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Anunciar carta de consórcio</h1>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      <form action={criarAnuncio} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-3 rounded border p-4">
          <legend className="px-1 text-sm font-medium">Dados da cota</legend>

          <select name="administradora_id" required className="rounded border px-3 py-2">
            <option value="">Administradora</option>
            {administradoras?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>

          <select name="tipo_bem" required className="rounded border px-3 py-2">
            <option value="veiculo">Veículo</option>
            <option value="imovel">Imóvel</option>
            <option value="moto">Moto</option>
            <option value="pesados">Pesados</option>
            <option value="servico">Serviço</option>
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input name="numero_grupo" placeholder="Nº do grupo" required className="rounded border px-3 py-2" />
            <input name="numero_cota" placeholder="Nº da cota" required className="rounded border px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              name="valor_credito"
              placeholder="Valor do crédito (R$)"
              inputMode="decimal"
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="saldo_devedor"
              placeholder="Saldo devedor (R$)"
              inputMode="decimal"
              required
              className="rounded border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <input
              name="valor_parcela"
              placeholder="Valor da parcela (R$)"
              inputMode="decimal"
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="parcelas_pagas"
              placeholder="Parcelas pagas"
              type="number"
              min={0}
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="parcelas_totais"
              placeholder="Parcelas totais"
              type="number"
              min={1}
              required
              className="rounded border px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="contemplada" /> Cota contemplada
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border p-4">
          <legend className="px-1 text-sm font-medium">Anúncio</legend>
          <input name="titulo" placeholder="Título do anúncio" required className="rounded border px-3 py-2" />
          <textarea name="descricao" placeholder="Descrição (opcional)" rows={4} className="rounded border px-3 py-2" />
          <input
            name="preco"
            placeholder="Preço de venda (R$)"
            inputMode="decimal"
            required
            className="rounded border px-3 py-2"
          />
          <label className="text-sm">
            Fotos (opcional, até 6)
            <input
              type="file"
              name="fotos"
              accept="image/*"
              multiple
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        </fieldset>

        <p className="text-xs text-neutral-500">
          Seu anúncio entra em análise antes de ficar visível publicamente.
        </p>

        <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
          Enviar para análise
        </button>
      </form>
    </main>
  );
}
