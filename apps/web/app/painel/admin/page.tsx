import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export default async function AdminPage() {
  await requireStaff();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-3 p-8">
      <h1 className="text-2xl font-semibold">Moderação</h1>
      <Link href="/painel/admin/kyc" className="rounded border p-4 hover:bg-neutral-50">
        Verificações de identidade pendentes
      </Link>
      <Link href="/painel/admin/anuncios" className="rounded border p-4 hover:bg-neutral-50">
        Anúncios pendentes de aprovação
      </Link>
    </main>
  );
}
