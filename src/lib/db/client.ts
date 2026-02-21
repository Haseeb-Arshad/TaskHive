
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL may be absent during Next.js build-time static generation
// (e.g. prerendering /_not-found). Provide a syntactically-valid placeholder
// so that postgres() doesn't throw "Invalid URL" at module-load time.
// No TCP connection is made until the first query is executed, so this is safe.
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/build-placeholder";

const sql = postgres(connectionString, { prepare: false });

export const db = drizzle(sql, { schema });
