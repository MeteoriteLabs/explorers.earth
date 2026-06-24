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

// Recursively synchronize the target object structure with the English object
function syncObjects(enObj, targetObj) {
  // If the English value is not a nested structure (primitive values like string, number, boolean)
  if (typeof enObj !== 'object' || enObj === null) {
    // If the target has a value of the same type, keep it. Otherwise, fallback to the English value.
    if (typeof targetObj === typeof enObj && targetObj !== null) {
      return targetObj;
    }
    return enObj;
  }

  // If the English value is an array
  if (Array.isArray(enObj)) {
    const syncedArray = [];
    enObj.forEach((enItem, index) => {
      const targetItem = Array.isArray(targetObj) ? targetObj[index] : undefined;
      syncedArray.push(syncObjects(enItem, targetItem));
    });
    return syncedArray;
  }

  // If the English value is an object
  const syncedObj = {};
  for (const key in enObj) {
    if (Object.prototype.hasOwnProperty.call(enObj, key)) {
      const enVal = enObj[key];
      const targetVal = (targetObj && typeof targetObj === 'object') ? targetObj[key] : undefined;
      syncedObj[key] = syncObjects(enVal, targetVal);
    }
  }
  return syncedObj;
}

// Recursively sort object keys alphabetically
function sortObjectKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sortedObj = {};
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }
  return sortedObj;
}

function run() {
  console.log('--- i18n Translation Sync Script ---');
  
  if (!fs.existsSync(enPath)) {
    console.error(`Error: Reference English translation file not found at: ${enPath}`);
    process.exit(1);
  }

  // 1. Read, strip BOM, sort and update English file
  console.log('Processing reference: en.json...');
  const enRaw = fs.readFileSync(enPath, 'utf8');
  const enData = JSON.parse(stripBOM(enRaw));
  const enSorted = sortObjectKeys(enData);
  fs.writeFileSync(enPath, JSON.stringify(enSorted, null, 2), 'utf8');
  console.log('✓ Normalized and sorted en.json successfully.');

  // 2. Read and synchronize all other language files
  const files = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.json') && f !== 'en.json');
  console.log(`Found ${files.length} translation files to synchronize.`);

  let totalUpdated = 0;

  for (const file of files) {
    const filePath = path.join(resourcesDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(stripBOM(raw));

      // Sync with English reference structure
      const synced = syncObjects(enSorted, data);
      
      // Sort keys alphabetically
      const sorted = sortObjectKeys(synced);

      // Write back without BOM, formatted
      fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2), 'utf8');
      console.log(`✓ Synchronized and sorted: ${file}`);
      totalUpdated++;
    } catch (err) {
      console.error(`❌ Error synchronizing file ${file}:`, err.message);
    }
  }

  console.log(`\nCompleted! Synchronized ${totalUpdated} of ${files.length} language files.`);
}

run();
