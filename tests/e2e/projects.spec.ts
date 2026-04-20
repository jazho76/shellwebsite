import type { Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

type Fake = {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
};

const repo = (overrides: Partial<Fake>): Fake => ({
  name: 'repo',
  description: 'a thing',
  html_url: 'https://github.com/testuser/repo',
  stargazers_count: 0,
  pushed_at: '2024-01-01T00:00:00Z',
  fork: false,
  archived: false,
  ...overrides,
});

const mountRepos = async (
  page: Parameters<typeof test.describe>[0] extends never
    ? never
    : Parameters<typeof bootAndReady>[0],
  body: Fake[] | null,
  opts: { status?: number; abort?: boolean } = {}
) => {
  await page.route('**/api.github.com/**', async (route: Route) => {
    if (opts.abort) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: opts.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(body ?? []),
    });
  });
};

test.describe('projects', () => {
  test('lists top N by stars, filters forks and archived', async ({ page }) => {
    await mountRepos(page, [
      repo({ name: 'big', stargazers_count: 100 }),
      repo({ name: 'mid', stargazers_count: 20 }),
      repo({ name: 'small', stargazers_count: 2 }),
      repo({ name: 'a-fork', stargazers_count: 999, fork: true }),
      repo({ name: 'archived', stargazers_count: 500, archived: true }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects');
    expect(out).not.toMatch(/a-fork/);
    expect(out).not.toMatch(/\barchived\b/);
    const bigIdx = out.indexOf('big');
    const midIdx = out.indexOf('mid');
    const smallIdx = out.indexOf('small');
    expect(bigIdx).toBeGreaterThanOrEqual(0);
    expect(midIdx).toBeGreaterThan(bigIdx);
    expect(smallIdx).toBeGreaterThan(midIdx);
  });

  test('numeric arg caps output', async ({ page }) => {
    await mountRepos(page, [
      repo({ name: 'one', stargazers_count: 5 }),
      repo({ name: 'two', stargazers_count: 4 }),
      repo({ name: 'three', stargazers_count: 3 }),
      repo({ name: 'four', stargazers_count: 2 }),
      repo({ name: 'five', stargazers_count: 1 }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects 2');
    expect(out).toMatch(/\bone\b/);
    expect(out).toMatch(/\btwo\b/);
    expect(out).not.toMatch(/\bthree\b/);
    expect(out).not.toMatch(/\bfour\b/);
  });

  test("'all' shows everything", async ({ page }) => {
    await mountRepos(page, [
      repo({ name: 'a', stargazers_count: 3 }),
      repo({ name: 'b', stargazers_count: 2 }),
      repo({ name: 'c', stargazers_count: 1 }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects all');
    expect(out).toMatch(/\ba\b/);
    expect(out).toMatch(/\bb\b/);
    expect(out).toMatch(/\bc\b/);
  });

  test('renders a clickable anchor for each repo', async ({ page }) => {
    await mountRepos(page, [
      repo({
        name: 'foo',
        html_url: 'https://github.com/testuser/foo',
        stargazers_count: 1,
      }),
    ]);
    await bootAndReady(page);
    await runCmd(page, 'projects');
    const href = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const a = last?.querySelector('a');
      return a?.getAttribute('href') ?? null;
    });
    expect(href).toBe('https://github.com/testuser/foo');
  });

  test('null description renders a placeholder', async ({ page }) => {
    await mountRepos(page, [
      repo({ name: 'blank', description: null, stargazers_count: 1 }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects');
    expect(out).toMatch(/\(no description\)/);
  });

  test("description sanitization: README-style links don't hijack the renderer", async ({
    page,
  }) => {
    await mountRepos(page, [
      repo({
        name: 'hack',
        description: 'read [README](./README.md) first',
        html_url: 'https://github.com/testuser/hack',
        stargazers_count: 1,
      }),
    ]);
    await bootAndReady(page);
    await runCmd(page, 'projects');
    const hrefs = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return [...(last?.querySelectorAll('a') ?? [])].map(a =>
        a.getAttribute('href')
      );
    });
    // Only the repo anchor; no description-borne link.
    expect(hrefs).toEqual(['https://github.com/testuser/hack']);
  });

  test('network failure surfaces a single stderr line', async ({ page }) => {
    await mountRepos(page, null, { abort: true });
    await bootAndReady(page);
    expect(await runCmd(page, 'projects')).toMatch(/cannot reach github/);
  });

  test('403 rate limit has its own message', async ({ page }) => {
    await mountRepos(page, [], { status: 403 });
    await bootAndReady(page);
    expect(await runCmd(page, 'projects')).toMatch(/rate-limited/);
  });

  test('bad count argument is rejected', async ({ page }) => {
    await mountRepos(page, [repo({ stargazers_count: 1 })]);
    await bootAndReady(page);
    expect(await runCmd(page, 'projects xyz')).toMatch(/not a valid count/);
  });

  test("empty repository list surfaces the 'no public repositories' line", async ({
    page,
  }) => {
    await mountRepos(page, []);
    await bootAndReady(page);
    expect(await runCmd(page, 'projects')).toMatch(/no public repositories/);
  });

  test('second invocation is served from cache — one network hit only', async ({
    page,
  }) => {
    let hits = 0;
    await page.route('**/api.github.com/**', async route => {
      hits++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([repo({ name: 'cached', stargazers_count: 9 })]),
      });
    });
    await bootAndReady(page);
    const first = await runCmd(page, 'projects');
    const second = await runCmd(page, 'projects');
    expect(hits).toBe(1);
    expect(first).toMatch(/Loading some GitHub repositories/);
    expect(second).not.toMatch(/Loading some GitHub repositories/);
  });

  test('starred repos appear before unstarred recent ones', async ({
    page,
  }) => {
    await mountRepos(page, [
      repo({
        name: 'fresh',
        stargazers_count: 0,
        pushed_at: '2025-01-01T00:00:00Z',
      }),
      repo({
        name: 'popular',
        stargazers_count: 5,
        pushed_at: '2020-01-01T00:00:00Z',
      }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects');
    const popIdx = out.indexOf('popular');
    const freshIdx = out.indexOf('fresh');
    expect(popIdx).toBeGreaterThanOrEqual(0);
    expect(freshIdx).toBeGreaterThan(popIdx);
  });

  test('unstarred recents sort by pushed_at desc', async ({ page }) => {
    await mountRepos(page, [
      repo({
        name: 'older',
        stargazers_count: 0,
        pushed_at: '2020-01-01T00:00:00Z',
      }),
      repo({
        name: 'newer',
        stargazers_count: 0,
        pushed_at: '2025-01-01T00:00:00Z',
      }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects');
    expect(out.indexOf('newer')).toBeLessThan(out.indexOf('older'));
  });

  test('unstarred rows use · prefix, starred use ★', async ({ page }) => {
    await mountRepos(page, [
      repo({ name: 'starry', stargazers_count: 7 }),
      repo({ name: 'plain', stargazers_count: 0 }),
    ]);
    await bootAndReady(page);
    const out = await runCmd(page, 'projects');
    expect(out).toMatch(/★\s+7\s+starry/);
    expect(out).toMatch(/·\s+plain/);
  });
});
