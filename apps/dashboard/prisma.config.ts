import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma does not read .env by itself: load it when present (Node ≥ 20.12).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  datasource: {
    // Same default as src/lib/db.ts, so `prisma generate` also works before .env exists.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
