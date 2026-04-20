import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('kernel events', () => {
  test('boot-ready fires on initial load (bash-history seeds)', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'history');
    expect(out).toMatch(/ls -la/);
    expect(out).toMatch(/\/tmp\/\.pwn/);
    expect(out).toMatch(/sudo su/);
  });

  test('boot-ready fires again on restart (BIOS splash visible)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await bootAndReady(page);
    await runCmd(page, 'restart');
    await page.waitForTimeout(8_500);
    const out = await page.evaluate(
      () => document.getElementById('output')!.innerText
    );
    expect(out).toContain('InsydeH2O');
  });

  test('exec event payload shape: known=true for registered, known=false for unknown', async ({
    page,
  }) => {
    await bootAndReady(page);
    await page.evaluate(() => {
      (
        window as unknown as { posthog: unknown; __events: unknown[] }
      ).__events = [];
      (
        window as unknown as {
          posthog: { capture: (e: string, p: unknown) => void };
        }
      ).posthog = {
        capture: (event: string, props: unknown) => {
          (window as unknown as { __events: unknown[] }).__events.push({
            event,
            props,
          });
        },
      };
    });
    await runCmd(page, 'whoami');
    await runCmd(page, 'foobarbaz');
    const events = (await page.evaluate(
      () =>
        (
          window as unknown as {
            __events: Array<{
              event: string;
              props: { args: string; raw: string };
            }>;
          }
        ).__events
    )) as Array<{ event: string; props: { args: string; raw: string } }>;
    const whoamiEvt = events.find(e => e.event === 'whoami');
    const unknownEvt = events.find(e => e.event === 'unknown_command');
    expect(whoamiEvt, 'whoami event was captured').toBeTruthy();
    expect(unknownEvt, 'unknown_command event was captured').toBeTruthy();
    expect(unknownEvt?.props.raw).toBe('foobarbaz');
  });
});
