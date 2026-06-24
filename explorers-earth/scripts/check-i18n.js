import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.join(__dirname, '..', 'src', 'i18n', 'resources');
const enPath = path.join(resourcesDir, 'en.json');

// Helper to strip BOM from UTF-8 files if present
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

// Helper to flatten a nested JSON object into dot-notation keys
function flattenObject(obj, prefix = '') {
  let keys = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const keyName = prefix ? `${prefix}.${k}` : k;
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(keys, flattenObject(obj[k], keyName));
      } else if (Array.isArray(obj[k])) {
        obj[k].forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.assign(keys, flattenObject(item, `${keyName}[${index}]`));
          } else {
            keys[`${keyName}[${index}]`] = item;
          }
        });
      } else {
        keys[keyName] = obj[k];
      }
    }
  }
  return keys;
}

function run() {
  console.log('--- i18n Translation Check Script ---');

  if (!fs.existsSync(enPath)) {
    console.error(`Error: Reference English translation file not found at: ${enPath}`);
    process.exit(1);
  }

  let enData;
  try {
    const enRaw = fs.readFileSync(enPath, 'utf8');
    enData = JSON.parse(stripBOM(enRaw));
  } catch (err) {
    console.error(`Error parsing reference English file:`, err.message);
    process.exit(1);
  }

  const enFlat = flattenObject(enData);
  const enKeys = Object.keys(enFlat);
  
  const files = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.json') && f !== 'en.json');
  let failures = 0;

  for (const file of files) {
    const filePath = path.join(resourcesDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      
      // Check for BOM
      if (raw.charCodeAt(0) === 0xFEFF) {
        console.warn(`⚠️ Warning: BOM character found in ${file}. Run sync script to remove it.`);
        failures++;
      }

      const data = JSON.parse(stripBOM(raw));
      const flat = flattenObject(data);
      
      const missingKeys = enKeys.filter(k => !Object.prototype.hasOwnProperty.call(flat, k));
      const staleKeys = Object.keys(flat).filter(k => !Object.prototype.hasOwnProperty.call(enFlat, k));

      if (missingKeys.length > 0) {
        console.error(`❌ ${file} has ${missingKeys.length} missing translation keys.`);
        missingKeys.slice(0, 5).forEach(k => console.error(`   - Missing key: ${k}`));
        if (missingKeys.length > 5) console.error(`   - ...and ${missingKeys.length - 5} more.`);
        failures++;
      }

      if (staleKeys.length > 0) {
        console.error(`❌ ${file} has ${staleKeys.length} stale/extra translation keys.`);
        staleKeys.slice(0, 5).forEach(k => console.error(`   - Stale key: ${k}`));
        if (staleKeys.length > 5) console.error(`   - ...and ${staleKeys.length - 5} more.`);
        failures++;
      }
      
    } catch (err) {
      console.error(`❌ Error parsing ${file}:`, err.message);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nValidation FAILED: Found issues in translation files. Run "npm run i18n:sync" to synchronize them.`);
    process.exit(1);
  } else {
    console.log(`\nValidation PASSED: All translation files are fully synchronized with en.json.`);
    process.exit(0);
  }
}

run();
