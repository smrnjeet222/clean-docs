import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getAccessLevel, canRead } from "@/lib/access";
import Editor from "@/components/Editor";
import type { DocumentDetail } from "@/hooks/documents";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (level === "none" || !canRead(level)) notFound();

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, contentHtml: true, version: true, updatedAt: true, ownerId: true,
      owner: { select: { name: true, email: true } },
      shares: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
      files: { select: { id: true, filename: true, mimeType: true, size: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!doc) notFound();

  const initial: DocumentDetail = {
    ...doc,
    updatedAt: doc.updatedAt.toISOString(),
    access: level,
  };

  return <Editor initial={initial} />;
}
