import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getAccessLevel } from "@/lib/access";

const shareSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(["VIEW", "EDIT"]).default("EDIT"),
});

type Params = { params: Promise<{ id: string }> };

// POST /api/documents/:id/share — owner grants another user access by email.
export async function POST(req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (level !== "owner") return NextResponse.json({ error: "Only the owner can share" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, role } = parsed.data;

  const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "No user with that email" }, { status: 404 });

  const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (target.id === doc?.ownerId) {
    return NextResponse.json({ error: "User already owns this document" }, { status: 400 });
  }

  const share = await prisma.share.upsert({
    where: { documentId_userId: { documentId: id, userId: target.id } },
    create: { documentId: id, userId: target.id, role },
    update: { role },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(share, { status: 201 });
}

// DELETE /api/documents/:id/share?email=... — owner revokes access.
export async function DELETE(req: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const level = await getAccessLevel(id, userId);
  if (level !== "owner") return NextResponse.json({ error: "Only the owner can revoke" }, { status: 403 });

  const email = new URL(req.url).searchParams.get("email")?.toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "No user with that email" }, { status: 404 });

  await prisma.share.deleteMany({ where: { documentId: id, userId: target.id } });
  return NextResponse.json({ ok: true });
}
