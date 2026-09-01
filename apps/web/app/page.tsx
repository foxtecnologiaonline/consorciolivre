import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Consórcio Livre</h1>
      <p className="text-neutral-600">
        Marketplace de cartas de consórcio entre usuários verificados.
      </p>
      <div className="flex gap-3">
        <Link href="/anuncios" className="rounded border px-4 py-2">
          Buscar cartas
        </Link>
        <Link href="/cadastro" className="rounded bg-neutral-900 px-4 py-2 text-white">
          Criar conta
        </Link>
      </div>
    </main>
  );
}
