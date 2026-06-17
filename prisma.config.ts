import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: connection URL lives here (for CLI: migrate/db push/introspect/seed),
// not in schema.prisma. Runtime connection uses a driver adapter — see src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
