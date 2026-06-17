import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import DocsList from "@/components/DocsList";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: session.userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.share.findMany({
      where: { userId: session.userId },
      orderBy: { document: { updatedAt: "desc" } },
      select: {
        role: true,
        document: { select: { id: true, title: true, updatedAt: true, owner: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-8 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Your documents</h1>
          <p className="text-sm text-neutral-500">Signed in as {session.name} ({session.email})</p>
        </div>
        <LogoutButton />
      </header>
      <DocsList
        owned={owned.map((d) => ({ ...d, updatedAt: d.updatedAt.toISOString() }))}
        shared={shared.map((s) => ({
          id: s.document.id,
          title: s.document.title,
          updatedAt: s.document.updatedAt.toISOString(),
          ownerName: s.document.owner.name,
          role: s.role,
        }))}
      />
    </main>
  );
}
