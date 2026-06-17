import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Seeds two demo users + a shared document so the owned-vs-shared distinction
// is visible immediately. Credentials are listed in the README.
async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice Owner", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com", name: "Bob Collaborator", passwordHash },
  });

  const existing = await prisma.document.findFirst({
    where: { ownerId: alice.id, title: "Welcome to Folio" },
  });

  if (!existing) {
    const doc = await prisma.document.create({
      data: {
        ownerId: alice.id,
        title: "Welcome to Folio",
        contentHtml:
          "<h1>Welcome</h1><p>This document is <strong>owned by Alice</strong> and <em>shared with Bob</em> (can edit).</p><ul><li>Try the formatting toolbar</li><li>Upload an attachment</li><li>Share with another user by email</li></ul>",
      },
    });
    await prisma.share.create({
      data: { documentId: doc.id, userId: bob.id, role: "EDIT" },
    });
  }

  console.log("Seeded: alice@example.com / bob@example.com (password: password123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
