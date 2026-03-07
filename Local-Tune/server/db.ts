import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Attempting to connect to database with URL:", process.env.DATABASE_URL.substring(0, 15) + "...[REDACTED]");

let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Test the connection
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
  });
  
  console.log("Database pool created successfully");
  db = drizzle({ client: pool, schema });
  console.log("Drizzle ORM initialized");
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  throw error;
}

export { pool, db };
