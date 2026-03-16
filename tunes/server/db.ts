import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from "ws";

import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';

import * as schema from "@shared/schema";
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

let pool: any;
let db: any;

try {
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
  console.log(`Connecting to database... (Is Neon: ${!!isNeon})`);
  
  if (isNeon) {
    // Neon PostgreSQL setup
    neonConfig.webSocketConstructor = ws;
    pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
    db = drizzleNeon({ client: pool, schema });
  } else {
    // Local PostgreSQL setup
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzlePg(pool, { schema }); // Using new drizzle signature
  }
  
  // Test the connection
  pool.on('error', (err: any) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
  });
  
  console.log("Database initialized successfully");
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  throw error;
}

export { pool, db };
