import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

// GET /api/documents — list documents the user owns or has been granted.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.share.findMany({
      where: { userId },
      orderBy: { document: { updatedAt: "desc" } },
      select: {
        role: true,
        document: {
          select: { id: true, title: true, updatedAt: true, owner: { select: { name: true, email: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    owned,
    shared: shared.map((s) => ({ ...s.document, role: s.role })),
  });
}

// POST /api/documents — create a new empty document owned by the user.
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.document.create({
    data: { ownerId: userId, title: "Untitled", contentHtml: "<p></p>" },
    select: { id: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
