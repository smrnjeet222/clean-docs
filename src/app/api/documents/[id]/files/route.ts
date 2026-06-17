import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getAccessLevel, canWrite } from "@/lib/access";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// Documented supported upload types (see README).
const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv",
]);

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/files — attach a file to the document (write access).
export async function POST(req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (!canWrite(level)) return NextResponse.json({ error: "No write access" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type || "unknown"}` }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await prisma.fileAsset.create({
    data: {
      documentId: id,
      filename: file.name.slice(0, 255),
      mimeType: file.type,
      size: file.size,
      data: bytes,
    },
    select: { id: true, filename: true, mimeType: true, size: true },
  });
  return NextResponse.json(saved, { status: 201 });
}
