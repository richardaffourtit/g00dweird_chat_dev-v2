#!/usr/bin/env node
// Slice imagegen's transparent 4x4 sheets without redrawing or trimming the art.
// Run from g00dweird_chat-main: node scripts/package_halloween_ghosts.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const appRoot = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(appRoot, 'frontend/package.json'));
const { chromium } = frontendRequire('playwright');
const publicRoot = path.join(appRoot, 'frontend/public');
const sourceRoot = path.join(publicRoot, 'source-assets/worlds/halloween-ghosts');
const outputRoot = path.join(publicRoot, 'assets/halloween/ghosts');
const names = ['Crooked Grin', 'Velvet Eyes', 'Little Wisp', 'Skull Veil'];
const includeWebp = process.argv.includes('--webp');
const states = {
  rise: { row: 0, frames: 4, fps: 7, loop: false, next: 'float' },
  float: { row: 1, frames: 4, fps: 6, loop: true },
  haunt: { row: 2, frames: 4, fps: 7, loop: false, next: 'float' },
  vanish: { row: 3, frames: 4, fps: 7, loop: false },
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const manifest = { version: 1, ghosts: [] };
  const audit = [];
  try {
    const page = await browser.newPage();
    for (let n = 1; n <= 4; n++) {
      const id = `ghost${n}`;
      const source = await fs.readFile(path.join(sourceRoot, `${id}-sheet-source.png`));
      const sheet = await page.evaluate(async ({ base64, id }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        if (image.width !== image.height) {
          throw new Error(`Expected square 4x4 sheet, got ${image.width}x${image.height}`);
        }
        // Generators can return dimensions not divisible by four. Pad cells to
        // a common integer size, preserving every source pixel without scaling.
        const nominalWidth = Math.ceil(image.width / 4);
        const sidePadding = 20;
        const width = nominalWidth + sidePadding * 2;
        const height = Math.ceil(image.height / 4);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const atlas = document.createElement('canvas');
        atlas.width = width * 4;
        atlas.height = height * 4;
        const atlasCtx = atlas.getContext('2d');
        const frames = [];
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            ctx.clearRect(0, 0, width, height);
            const nominalX = Math.round(col * image.width / 4);
            const boundaries = Array.from({ length: 5 }, (_, i) => Math.round(i * image.width / 4));
            // The third ghost's wide haunt pose crosses the nominal divider.
            // Its actual transparent gutter is at x=959 in the 1254px source.
            // Assign the whole pose to its cell, retaining its original pivot.
            if (id === 'ghost3' && row === 2 && image.width === 1254) boundaries[3] = 959;
            const sx = boundaries[col];
            const sy = Math.round(row * image.height / 4);
            const sw = boundaries[col + 1] - sx;
            const sh = Math.round((row + 1) * image.height / 4) - sy;
            ctx.drawImage(image, sx, sy, sw, sh, sidePadding + sx - nominalX, 0, sw, sh);
            const pixels = ctx.getImageData(0, 0, width, height).data;
            let visible = 0;
            let transparent = 0;
            let minX = width, minY = height, maxX = -1, maxY = -1;
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const alpha = pixels[(y * width + x) * 4 + 3];
                if (!alpha) transparent++;
                if (alpha > 8) {
                  visible++;
                  minX = Math.min(minX, x); minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                }
              }
            }
            if (transparent < width * height * 0.15) throw new Error(`Cell ${row},${col} lacks genuine alpha transparency`);
            if (visible < 8) throw new Error(`Cell ${row},${col} is empty`);
            atlasCtx.drawImage(canvas, col * width, row * height);
            frames.push({
              row, col, visible, transparent,
              bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
              png: canvas.toDataURL('image/png').split(',')[1],
            });
          }
        }
        return { width, height, frames, atlas: atlas.toDataURL('image/png').split(',')[1] };
      }, { base64: source.toString('base64'), id });
      const folder = path.join(outputRoot, id);
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, 'sheet.png'), Buffer.from(sheet.atlas, 'base64'));
      const animations = {};
      for (const [state, settings] of Object.entries(states)) {
        const frames = sheet.frames.filter(frame => frame.row === settings.row);
        for (const frame of frames) {
          await fs.writeFile(path.join(folder, `${state}_${frame.col}.png`), Buffer.from(frame.png, 'base64'));
          audit.push({ ghost: id, state, index: frame.col, ...frame, png: undefined });
        }
        animations[state] = {
          ...settings,
          files: frames.map(frame => `/assets/halloween/ghosts/${id}/${state}_${frame.col}.png`),
          atlasFrames: frames.map(frame => ({ x: frame.col * sheet.width, y: frame.row * sheet.height, w: sheet.width, h: sheet.height })),
        };
      }
      if (includeWebp) {
        const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
          '-framerate', '6', '-i', path.join(folder, 'float_%d.png'), '-frames:v', '4',
          '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', '-an', path.join(folder, 'float.webp')],
          { encoding: 'utf8' });
        if (encoded.error || encoded.status !== 0) throw new Error(encoded.error?.message || encoded.stderr);
      }
      manifest.ghosts.push({
        id, name: names[n - 1],
        sheet: `/assets/halloween/ghosts/${id}/sheet.png`,
        frameWidth: sheet.width, frameHeight: sheet.height,
        anchor: { x: 0.5, y: 0.96 },
        ...(includeWebp ? { preview: `/assets/halloween/ghosts/${id}/float.webp` } : {}),
        animations,
      });
    }
    await fs.writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await fs.mkdir(path.join(appRoot, 'reports'), { recursive: true });
    await fs.writeFile(path.join(appRoot, 'reports/halloween-ghost-assets.json'), JSON.stringify({ ghostCount: 4, frameCount: audit.length, frames: audit }, null, 2) + '\n');
    console.log(`Packaged ${manifest.ghosts.length} ghosts / ${audit.length} transparent frames.`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
