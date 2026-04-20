import type { PluginInstall } from '../core/kernel.js';
import { settings } from '../me/settings.js';

const POSTHOG_KEY = settings.posthogKey;
const POSTHOG_HOST = 'https://us.i.posthog.com';

declare global {
  interface Window {
    posthog?: any;
  }
}

function loadPostHog(key: string, host: string): void {
  const stub: any = [];
  stub._i = [];
  stub.init = (k: string, c: unknown, name?: string) => {
    stub._i.push([k, c, name]);
  };
  for (const method of [
    'capture',
    'identify',
    'set_config',
    'reset',
    'register',
  ]) {
    stub[method] = (...args: unknown[]) => {
      stub.push([method, ...args]);
    };
  }
  window.posthog = stub;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src =
    host.replace('.i.posthog.com', '-assets.i.posthog.com') +
    '/static/array.js';
  document.head.appendChild(script);

  window.posthog.init(key, {
    api_host: host,
    defaults: '2026-01-30',
    person_profiles: 'always',
  });
}

const install: PluginInstall = kernel => {
  if (!POSTHOG_KEY) {
    return;
  }

  loadPostHog(POSTHOG_KEY, POSTHOG_HOST);

  kernel.on('exec', ({ name, args, raw, known }) => {
    try {
      window.posthog?.capture(known ? name : 'unknown_command', {
        args: args.join(' '),
        raw,
      });
    } catch (_) {
      /* ignore */
    }
  });
};

export default install;
