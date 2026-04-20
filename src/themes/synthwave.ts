import type { Theme } from './index.js';

const theme: Theme = {
  name: 'synthwave',
  describe: '80s neon — magenta and cyan on deep purple',
  css: `
body[data-theme="synthwave"] {
  --bg: #241b2f;
  --fg: #f0eff1;
  --prompt-host: #72f1b8;
  --prompt-cwd: #ff7edb;
  --link: #36f9f6;
  --cursor-bg: #f0eff1;
  --cursor-fg: #241b2f;
  --text-shadow: 0 0 2px rgba(255, 126, 219, 0.6);

  --ansi-0: #241b2f;
  --ansi-1: #fe4450;
  --ansi-2: #72f1b8;
  --ansi-3: #fede5d;
  --ansi-4: #6e4ab0;
  --ansi-5: #ff7edb;
  --ansi-6: #36f9f6;
  --ansi-7: #f0eff1;
  --ansi-8: #495495;
  --ansi-9: #ff6e6e;
  --ansi-10: #9effc7;
  --ansi-11: #fff591;
  --ansi-12: #a077e0;
  --ansi-13: #ffb0ec;
  --ansi-14: #8dfbfb;
  --ansi-15: #ffffff;
}
`,
};

export default theme;
