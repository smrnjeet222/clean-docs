import { prisma } from "./db";

export type AccessLevel = "owner" | "edit" | "view" | "none";

/**
 * Resolve a user's access level to a document.
 * Owner > explicit share (EDIT/VIEW) > none.
 */
export async function getAccessLevel(documentId: string, userId: string): Promise<AccessLevel> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true },
  });
  if (!doc) return "none";
  if (doc.ownerId === userId) return "owner";

  const share = await prisma.share.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { role: true },
  });
  if (!share) return "none";
  return share.role === "EDIT" ? "edit" : "view";
}

export function canRead(level: AccessLevel) {
  return level !== "none";
}

export function canWrite(level: AccessLevel) {
  return level === "owner" || level === "edit";
}
