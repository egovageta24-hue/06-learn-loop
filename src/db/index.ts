import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// The WebSocket Pool driver (not neon-http) is required: quiz submission runs
// as an interactive transaction, which the HTTP driver can't do.
const globalForDb = globalThis as unknown as { __learnloopPool?: Pool };

const pool =
  globalForDb.__learnloopPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.__learnloopPool = pool;

export { pool };
export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
