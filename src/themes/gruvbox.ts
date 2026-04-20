import type { Theme } from './index.js';

const theme: Theme = {
  name: 'gruvbox',
  describe: 'retro warm browns and oranges on dark',
  css: `
body[data-theme="gruvbox"] {
  --bg: #282828;
  --fg: #ebdbb2;
  --prompt-host: #b8bb26;
  --prompt-cwd: #83a598;
  --link: #fabd2f;
  --cursor-bg: #ebdbb2;
  --cursor-fg: #282828;
  --text-shadow: none;

  --ansi-0: #282828;
  --ansi-1: #cc241d;
  --ansi-2: #98971a;
  --ansi-3: #d79921;
  --ansi-4: #458588;
  --ansi-5: #b16286;
  --ansi-6: #689d6a;
  --ansi-7: #a89984;
  --ansi-8: #928374;
  --ansi-9: #fb4934;
  --ansi-10: #b8bb26;
  --ansi-11: #fabd2f;
  --ansi-12: #83a598;
  --ansi-13: #d3869b;
  --ansi-14: #8ec07c;
  --ansi-15: #ebdbb2;
}
`,
};

export default theme;
