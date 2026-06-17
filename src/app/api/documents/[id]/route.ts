import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getAccessLevel, canRead, canWrite } from "@/lib/access";
import { sanitizeDocumentHtml } from "@/lib/sanitize";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentHtml: z.string().max(1_000_000).optional(),
  // Optimistic concurrency: the version the client last saw. When present on a
  // content write, the update only applies if the server is still at that
  // version — otherwise a concurrent editor won and we return 409.
  lastSeenVersion: z.number().int().nonnegative().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id — full document if the user can read it.
export async function GET(_req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (!canRead(level)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, title: true, contentHtml: true, version: true, updatedAt: true, ownerId: true,
      owner: { select: { name: true, email: true } },
      shares: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
      files: { select: { id: true, filename: true, mimeType: true, size: true }, orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json({ ...doc, access: level });
}

// PUT /api/documents/:id — update title/content if the user can write.
export async function PUT(req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (!canRead(level)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canWrite(level)) return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { title, contentHtml, lastSeenVersion } = parsed.data;
  const isContentWrite = contentHtml !== undefined;

  const data: { title?: string; contentHtml?: string; version?: { increment: number } } = {};
  if (title !== undefined) data.title = title;
  if (isContentWrite) {
    data.contentHtml = sanitizeDocumentHtml(contentHtml);
    data.version = { increment: 1 }; // every content write advances the version
  }

  // Version-guarded write: if the caller told us which version they edited, only
  // apply when the server still holds that version. Zero rows updated = a
  // concurrent editor advanced it first → 409 so the client can reconcile.
  if (isContentWrite && lastSeenVersion !== undefined) {
    const result = await prisma.document.updateMany({
      where: { id, version: lastSeenVersion },
      data,
    });
    if (result.count === 0) {
      const current = await prisma.document.findUnique({ where: { id }, select: { version: true } });
      return NextResponse.json(
        { error: "Document changed since you opened it", currentVersion: current?.version },
        { status: 409 },
      );
    }
    const updated = await prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, version: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.document.update({
    where: { id },
    data,
    select: { id: true, title: true, version: true, updatedAt: true },
  });
  return NextResponse.json(updated);
}

// DELETE /api/documents/:id — owner only.
export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (level !== "owner") return NextResponse.json({ error: "Only the owner can delete" }, { status: 403 });

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
