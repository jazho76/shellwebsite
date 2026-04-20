import type { Page } from '@playwright/test';

export async function bootAndReady(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(
    () => !document.getElementById('input-line')!.classList.contains('hidden'),
    undefined,
    { timeout: 15_000 }
  );
  // Wait out the boot-splash fakeType of "welcome" (~50ms/char).
  await page.waitForTimeout(3_500);
}

export async function runCmd(
  page: Page,
  cmd: string,
  waitMs = 350
): Promise<string> {
  const before = await page.evaluate(
    () => document.querySelectorAll('#output .entry').length
  );
  await page.evaluate(c => {
    const input = document.getElementById('input') as HTMLInputElement;
    input.focus();
    input.value = c;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
  }, cmd);
  await page
    .waitForFunction(
      b => document.querySelectorAll('#output .entry').length > b,
      before,
      { timeout: 5_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(waitMs);
  return page.evaluate(() => {
    const entries = document.querySelectorAll('#output .entry');
    const last = entries[entries.length - 1];
    if (!last) {
      return '';
    }
    const out = last.querySelector('.out');
    return out ? (out as HTMLElement).innerText : '';
  });
}

export async function ident(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector('#input-line .host')?.textContent ?? ''
  );
}

export async function awaitRoot(page: Page, seconds = 30): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if (/^root@/.test(await ident(page))) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

export async function tab(page: Page, value: string): Promise<string> {
  await page.evaluate(v => {
    const input = document.getElementById('input') as HTMLInputElement;
    input.focus();
    input.value = v;
    input.setSelectionRange(v.length, v.length);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );
  }, value);
  await page.waitForTimeout(150);
  const out = await page.evaluate(
    () => (document.getElementById('input') as HTMLInputElement).value
  );
  await page.evaluate(() => {
    (document.getElementById('input') as HTMLInputElement).value = '';
  });
  return out;
}

export async function tabTwice(page: Page, value: string): Promise<string> {
  await tab(page, value);
  await page.evaluate(v => {
    const input = document.getElementById('input') as HTMLInputElement;
    input.focus();
    input.value = v;
    input.setSelectionRange(v.length, v.length);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );
  }, value);
  await page.waitForTimeout(200);
  const all = await page.evaluate(
    () => document.getElementById('output')!.innerText
  );
  await page.evaluate(() => {
    (document.getElementById('input') as HTMLInputElement).value = '';
  });
  return all;
}

export async function allOutput(page: Page): Promise<string> {
  return page.evaluate(() => document.getElementById('output')!.innerText);
}

export type RequestRecorder = {
  urls: string[];
  stop(): void;
};

export function recordRequests(page: Page): RequestRecorder {
  const urls: string[] = [];
  const handler = (req: { url(): string }) => {
    const u = req.url();
    if (u.startsWith('http://localhost:4173/')) {
      urls.push(u.replace('http://localhost:4173', ''));
    }
  };
  page.on('request', handler);
  return {
    urls,
    stop() {
      page.off('request', handler);
    },
  };
}
