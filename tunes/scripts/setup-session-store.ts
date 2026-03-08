import { pool } from '../server/db';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupSessionTable() {
  try {
    console.log('Setting up session table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'session-table.sql');
    console.log('SQL path:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('Session table setup complete.');
  } catch (error) {
    console.error('Error setting up session table:', error);
  } finally {
    // Close the pool connection
    await pool.end();
  }
}

setupSessionTable()
  .then(() => console.log('Setup complete'))
  .catch(err => console.error('Setup failed:', err));