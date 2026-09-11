import { requireProfile } from "@/lib/auth";

export default async function ContaPage() {
  await requireProfile();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Conta e privacidade</h1>

      <div className="rounded border p-4">
        <h2 className="mb-1 text-sm font-medium">Exportar meus dados</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Baixe uma cópia de tudo que temos sobre você: perfil, anúncios, propostas, transações,
          avaliações e mensagens que você enviou.
        </p>
        <a href="/api/conta/exportar" className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Baixar meus dados (JSON)
        </a>
      </div>
    </main>
  );
}
