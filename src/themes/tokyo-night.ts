import type { Theme } from './index.js';

const theme: Theme = {
  name: 'tokyo-night',
  describe: 'deep blue night with purple and cyan highlights',
  css: `
body[data-theme="tokyo-night"] {
  --bg: #1a1b26;
  --fg: #c0caf5;
  --prompt-host: #9ece6a;
  --prompt-cwd: #7aa2f7;
  --link: #7dcfff;
  --cursor-bg: #c0caf5;
  --cursor-fg: #1a1b26;
  --text-shadow: none;

  --ansi-0: #15161e;
  --ansi-1: #f7768e;
  --ansi-2: #9ece6a;
  --ansi-3: #e0af68;
  --ansi-4: #7aa2f7;
  --ansi-5: #bb9af7;
  --ansi-6: #7dcfff;
  --ansi-7: #a9b1d6;
  --ansi-8: #414868;
  --ansi-9: #f7768e;
  --ansi-10: #9ece6a;
  --ansi-11: #e0af68;
  --ansi-12: #7aa2f7;
  --ansi-13: #bb9af7;
  --ansi-14: #7dcfff;
  --ansi-15: #c0caf5;
}
`,
};

export default theme;
