import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getAccessLevel, canRead } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/duplicate — copy a document the user can read into a
// new document owned by them (title, content, and attachments). Owners and
// shared users alike can take their own copy.
export async function POST(_req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (!canRead(level)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const src = await prisma.document.findUnique({
    where: { id },
    select: {
      title: true,
      contentHtml: true,
      files: { select: { filename: true, mimeType: true, size: true, data: true } },
    },
  });
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.document.create({
    data: { ownerId: userId, title: `${src.title} (copy)`, contentHtml: src.contentHtml },
    select: { id: true },
  });

  if (src.files.length > 0) {
    await prisma.fileAsset.createMany({
      data: src.files.map((f) => ({
        documentId: copy.id,
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size,
        data: f.data,
      })),
    });
  }

  return NextResponse.json(copy, { status: 201 });
}
