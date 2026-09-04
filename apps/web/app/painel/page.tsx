import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

const KYC_LABEL: Record<string, string> = {
  pendente: "Verificação não iniciada",
  em_analise: "Verificação em análise",
  aprovado: "Verificado",
  reprovado: "Verificação reprovada",
};

export default async function PainelPage() {
  const { profile } = await requireProfile();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {profile.nome_completo.split(" ")[0]}</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            Sair
          </button>
        </form>
      </div>

      <div className="rounded border p-4">
        <p className="text-sm text-neutral-600">Status de verificação (KYC)</p>
        <p className="font-medium">{KYC_LABEL[profile.kyc_status]}</p>
        {profile.kyc_status !== "aprovado" && (
          <Link href="/painel/verificacao" className="mt-2 inline-block text-sm underline">
            {profile.kyc_status === "em_analise" ? "Ver status" : "Solicitar verificação"}
          </Link>
        )}
      </div>

      <nav className="flex flex-col gap-2">
        <Link href="/anuncios" className="rounded border p-4 hover:bg-neutral-50">
          Buscar cartas de consórcio
        </Link>
        <Link href="/painel/anuncios" className="rounded border p-4 hover:bg-neutral-50">
          Meus anúncios
        </Link>
        <Link href="/painel/propostas" className="rounded border p-4 hover:bg-neutral-50">
          Propostas
        </Link>
        <Link href="/painel/chat" className="rounded border p-4 hover:bg-neutral-50">
          Conversas
        </Link>
        <Link href="/painel/transacoes" className="rounded border p-4 hover:bg-neutral-50">
          Transações
        </Link>
        {(profile.role === "staff" || profile.role === "admin") && (
          <Link href="/painel/admin" className="rounded border p-4 hover:bg-neutral-50">
            Painel de moderação (staff)
          </Link>
        )}
      </nav>
    </main>
  );
}
