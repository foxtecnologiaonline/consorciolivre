import Link from "next/link";
import { signIn } from "../actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      {searchParams.erro && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{searchParams.erro}</p>
      )}

      <form action={signIn} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          required
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-neutral-900 py-2 text-white">
          Entrar
        </button>
      </form>

      <p className="text-sm text-neutral-600">
        Não tem conta?{" "}
        <Link href="/cadastro" className="underline">
          Cadastre-se
        </Link>
      </p>
    </main>
  );
}
