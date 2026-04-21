import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { bootAndReady, runCmd } from './harness.js';

const THEMES = [
  'catppuccin-mocha',
  'crt',
  'dracula',
  'espresso',
  'graphite',
  'gruvbox',
  'jazho76',
  'matrix',
  'nord',
  'synthwave',
  'tokyo-night',
];

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT_DIR = 'docs/themes';

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        baseURL: BASE,
      });
      const page = await context.newPage();
      await bootAndReady(page);
      await runCmd(page, `theme ${theme}`);
      await runCmd(page, 'clear && colortest', 500);
      await page.waitForTimeout(300);
      const path = `${OUT_DIR}/${theme}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log(`saved ${path}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
