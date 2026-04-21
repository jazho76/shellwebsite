import type { Theme } from './index.js';

const theme: Theme = {
  name: 'catppuccin-mocha',
  describe: 'pastel dark, signature Catppuccin',
  css: `
body[data-theme="catppuccin-mocha"] {
  --bg: #1e1e2e;
  --fg: #cdd6f4;
  --prompt-host: #cba6f7;
  --prompt-cwd: #89b4fa;
  --link: #74c7ec;
  --cursor-bg: #f5e0dc;
  --cursor-fg: #1e1e2e;
  --text-shadow: none;

  --ansi-0: #45475a;
  --ansi-1: #f38ba8;
  --ansi-2: #a6e3a1;
  --ansi-3: #f9e2af;
  --ansi-4: #89b4fa;
  --ansi-5: #f5c2e7;
  --ansi-6: #94e2d5;
  --ansi-7: #bac2de;
  --ansi-8: #585b70;
  --ansi-9: #f38ba8;
  --ansi-10: #a6e3a1;
  --ansi-11: #f9e2af;
  --ansi-12: #89b4fa;
  --ansi-13: #f5c2e7;
  --ansi-14: #94e2d5;
  --ansi-15: #a6adc8;
}
`,
};

export default theme;
