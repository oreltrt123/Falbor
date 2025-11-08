import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../schema";

if (!process.env.NEON_NEON_DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(process.env.NEON_NEON_DATABASE_URL);
export const db = drizzle(sql, { schema });
