import type { Theme } from './index.js';

const theme: Theme = {
  name: 'dracula',
  describe: 'dark with vibrant pink, purple, and cyan accents',
  css: `
body[data-theme="dracula"] {
  --bg: #282a36;
  --fg: #f8f8f2;
  --prompt-host: #50fa7b;
  --prompt-cwd: #8be9fd;
  --link: #8be9fd;
  --cursor-bg: #f8f8f2;
  --cursor-fg: #282a36;
  --text-shadow: none;

  --ansi-0: #21222c;
  --ansi-1: #ff5555;
  --ansi-2: #50fa7b;
  --ansi-3: #f1fa8c;
  --ansi-4: #bd93f9;
  --ansi-5: #ff79c6;
  --ansi-6: #8be9fd;
  --ansi-7: #f8f8f2;
  --ansi-8: #6272a4;
  --ansi-9: #ff6e6e;
  --ansi-10: #69ff94;
  --ansi-11: #ffffa5;
  --ansi-12: #d6acff;
  --ansi-13: #ff92df;
  --ansi-14: #a4ffff;
  --ansi-15: #ffffff;
}
`,
};

export default theme;
