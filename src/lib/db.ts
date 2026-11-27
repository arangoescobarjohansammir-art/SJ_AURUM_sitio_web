import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalDb = globalThis as unknown as { aurumDb?: PrismaClient };
export function getDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL no está configurada");
  if (!globalDb.aurumDb) {
    globalDb.aurumDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: [],
    });
  }
  return globalDb.aurumDb;
}
