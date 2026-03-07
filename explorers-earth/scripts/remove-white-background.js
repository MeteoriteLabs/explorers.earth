/**
 * Removes white / near-white / light gray background from an image by making those pixels transparent.
 * Usage: node scripts/remove-white-background.js [input-path] [output-path]
 * Default input: public/images/recommendations.png
 * If output-path is given, writes there and does not overwrite input. Otherwise overwrites input after backup.
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultInput = path.join(projectRoot, "public", "images", "recommendations.png");

// Pixels with r,g,b >= this become transparent. 220 = light gray and cream removed too.
const WHITE_THRESHOLD = 220;

async function removeWhiteBackground(inputPath, outputPath) {
  if (!existsSync(inputPath)) {
    console.error("File not found:", inputPath);
    process.exit(1);
  }

  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const backupPath = path.join(dir, `${base}-backup${ext}`);
  const writePath = outputPath || inputPath;

  if (!outputPath) {
    const originalBuffer = readFileSync(inputPath);
    writeFileSync(backupPath, originalBuffer);
    console.log("Backup written:", backupPath);
  }

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let changed = 0;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[i + 3] = 0;
      changed++;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(writePath);

  console.log("Done. Made", changed, "pixels transparent. Output:", writePath);
}

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
removeWhiteBackground(inputPath, outputPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
