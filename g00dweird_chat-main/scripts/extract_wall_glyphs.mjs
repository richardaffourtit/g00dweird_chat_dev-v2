#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.cwd());
const sheetsDir = path.join(root, 'frontend/public/wall/glyph-sheets');
const outDir = path.join(root, 'frontend/public/wall/glyphs');
const manifestPath = path.join(outDir, 'manifest.json');

const sheets = [
  { id: 'sheet1', file: 'wall-exe-glyphs1.png' },
  { id: 'sheet2', file: 'wall-exe-glyphs2.png' },
  { id: 'sheet3', file: 'wall-exe-glyphs3.png' },
];
const cols = 5;
const rows = 8;
const width = 1024;
const height = 1536;

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (/^wall-glyph-.*\.png$/.test(file)) fs.rmSync(path.join(outDir, file));
}

const glyphs = [];
let index = 1;
for (const sheet of sheets) {
  const src = path.join(sheetsDir, sheet.file);
  if (!fs.existsSync(src)) throw new Error(`missing sheet ${src}`);
  for (let row = 0; row < rows; row += 1) {
    const y1 = Math.round((row * height) / rows);
    const y2 = Math.round(((row + 1) * height) / rows);
    for (let col = 0; col < cols; col += 1) {
      const x1 = Math.round((col * width) / cols);
      const x2 = Math.round(((col + 1) * width) / cols);
      const cropW = x2 - x1;
      const cropH = y2 - y1;
      const id = `wall-glyph-${String(index).padStart(3, '0')}`;
      const file = `${id}.png`;
      const out = path.join(outDir, file);
      const result = spawnSync('sips', [
        '--cropToHeightWidth', String(cropH), String(cropW),
        '--cropOffset', String(y1), String(x1),
        src,
        '--out', out,
      ], { encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(`sips failed for ${id}: ${result.stderr || result.stdout}`);
      }
      glyphs.push({
        id,
        label: `Glyph ${index}`,
        url: `/wall/glyphs/${file}`,
        source: `/wall/glyph-sheets/${sheet.file}`,
        sheet: sheet.id,
        row,
        col,
        crop: { x: x1, y: y1, w: cropW, h: cropH },
        kind: 'graffiti-glyph',
      });
      index += 1;
    }
  }
}

const manifest = {
  schema: 'g00dweird.wallGlyphs.v1',
  generatedAt: new Date().toISOString(),
  extraction: {
    method: 'fixed-grid',
    cols,
    rows,
    sourceWidth: width,
    sourceHeight: height,
  },
  sheets: sheets.map((sheet) => ({ ...sheet, url: `/wall/glyph-sheets/${sheet.file}` })),
  glyphs,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`extracted ${glyphs.length} glyphs -> ${path.relative(root, outDir)}`);
