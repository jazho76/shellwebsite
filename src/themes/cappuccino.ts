import type { Theme } from './index.js';

const theme: Theme = {
  name: 'cappuccino',
  describe: 'warm cream with espresso text',
  css: `
body[data-theme="cappuccino"] {
  --bg: #f5ebdc;
  --fg: #3d2817;
  --prompt-host: #7a4a28;
  --prompt-cwd: #6b5230;
  --link: #7a4a28;
  --cursor-bg: #3d2817;
  --cursor-fg: #f5ebdc;
  --text-shadow: none;

  --ansi-0: #3d2817;
  --ansi-1: #a84432;
  --ansi-2: #5a7a2e;
  --ansi-3: #b08040;
  --ansi-4: #4a6078;
  --ansi-5: #8a4a6a;
  --ansi-6: #4a7a7a;
  --ansi-7: #6b5230;
  --ansi-8: #8a6c4a;
  --ansi-9: #c85a48;
  --ansi-10: #7a9a3e;
  --ansi-11: #c89450;
  --ansi-12: #6a8098;
  --ansi-13: #a86a8a;
  --ansi-14: #6a9a9a;
  --ansi-15: #3d2817;
}
`,
};

export default theme;
