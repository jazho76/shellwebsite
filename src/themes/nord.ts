import type { Theme } from './index.js';

const theme: Theme = {
  name: 'nord',
  describe: 'cool arctic palette, clean and modern',
  css: `
body[data-theme="nord"] {
  --bg: #2e3440;
  --fg: #d8dee9;
  --prompt-host: #a3be8c;
  --prompt-cwd: #81a1c1;
  --link: #88c0d0;
  --cursor-bg: #d8dee9;
  --cursor-fg: #2e3440;
  --text-shadow: none;

  --ansi-0: #3b4252;
  --ansi-1: #bf616a;
  --ansi-2: #a3be8c;
  --ansi-3: #ebcb8b;
  --ansi-4: #81a1c1;
  --ansi-5: #b48ead;
  --ansi-6: #88c0d0;
  --ansi-7: #e5e9f0;
  --ansi-8: #4c566a;
  --ansi-9: #bf616a;
  --ansi-10: #a3be8c;
  --ansi-11: #ebcb8b;
  --ansi-12: #81a1c1;
  --ansi-13: #b48ead;
  --ansi-14: #8fbcbb;
  --ansi-15: #eceff4;
}
`,
};

export default theme;
