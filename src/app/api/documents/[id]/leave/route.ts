import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/leave — a shared user removes their own access.
// (Owners can't "leave" their own document — they delete it instead.)
export async function POST(_req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.share.deleteMany({ where: { documentId: id, userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "You don't have shared access to leave" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
