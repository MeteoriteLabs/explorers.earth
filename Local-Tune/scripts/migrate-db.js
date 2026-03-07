import { execSync } from 'child_process';

console.log('Running database migration...');
try {
  execSync('npx drizzle-kit push --accept-data-loss', { stdio: 'inherit' });
  console.log('Migration completed successfully');
} catch (error) {
  console.error('Migration failed:', error);
}