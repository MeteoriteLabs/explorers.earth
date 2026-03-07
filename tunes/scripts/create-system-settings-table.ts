import { drizzle } from "drizzle-orm/neon-serverless";
import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { neon } from '@neondatabase/serverless';
import "dotenv/config";

// Define the system_settings table schema
const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  isSecret: boolean("is_secret").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

async function createSystemSettingsTable() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    
    // First, check if the table exists
    const checkTable = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      );
    `;
    
    if (checkTable[0].exists) {
      console.log("The system_settings table already exists.");
      return;
    }
    
    // Create the system_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        is_secret BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by INTEGER
      );
    `;
    
    console.log("Successfully created system_settings table");
    
    // Create an initial record for app_url
    await sql`
      INSERT INTO system_settings (key, value, description, category)
      VALUES (
        'app_url', 
        'https://c126e283-bf76-415e-88ef-a2a78e347c9a-00-3bmhn9lgr6c8q.riker.replit.dev', 
        'Application URL used for email verification links and other external references',
        'urls'
      );
    `;
    
    console.log("Added initial app_url setting");
    
  } catch (error) {
    console.error("Error creating system_settings table:", error);
  }
}

createSystemSettingsTable();