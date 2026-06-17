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
    <main className="mx-auto w-full max-w-[1120px] px-6 py-14 md:px-10">
      <header className="mb-12 flex items-end justify-between border-b border-carbon/10 pb-8">
        <div>
          <h1 className="font-editorial text-[52px] leading-[1.08]">Documents</h1>
          <p className="mt-2 text-[14px] text-graphite">
            Signed in as <span className="text-pewter">{session.name}</span> · {session.email}
          </p>
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
