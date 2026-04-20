import type { Theme } from './index.js';

const theme: Theme = {
  name: 'graphite',
  describe: 'dark minimal — the out-of-box look',
  css: `
body[data-theme="graphite"] {
  --bg: #161616;
  --fg: #ffffff;
  --prompt-host: #269e63;
  --prompt-cwd: #12488b;
  --link: #ffffff;
  --cursor-bg: #ffffff;
  --cursor-fg: #161616;
  --text-shadow: none;

  --ansi-0: #000000;
  --ansi-1: #cd3131;
  --ansi-2: #0dbc79;
  --ansi-3: #e5e510;
  --ansi-4: #2472c8;
  --ansi-5: #bc3fbc;
  --ansi-6: #11a8cd;
  --ansi-7: #e5e5e5;
  --ansi-8: #666666;
  --ansi-9: #f14c4c;
  --ansi-10: #23d18b;
  --ansi-11: #f5f543;
  --ansi-12: #3b8eea;
  --ansi-13: #d670d6;
  --ansi-14: #29b8db;
  --ansi-15: #ffffff;
}
`,
};

export default theme;
