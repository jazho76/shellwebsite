import type { Theme } from './index.js';

const theme: Theme = {
  name: 'matrix',
  describe: 'strict green-on-black, deeper than crt',
  css: `
body[data-theme="matrix"] {
  --bg: #000000;
  --fg: #00ff41;
  --prompt-host: #00ff41;
  --prompt-cwd: #00b82e;
  --link: #00ff41;
  --cursor-bg: #00ff41;
  --cursor-fg: #000000;
  --text-shadow: 0 0 3px rgba(0, 255, 65, 0.5);

  --ansi-0: #000000;
  --ansi-1: #ff4141;
  --ansi-2: #00ff41;
  --ansi-3: #b3ff41;
  --ansi-4: #00b82e;
  --ansi-5: #41ff88;
  --ansi-6: #00cc33;
  --ansi-7: #b0ffb0;
  --ansi-8: #005c0a;
  --ansi-9: #ff7070;
  --ansi-10: #6fff6f;
  --ansi-11: #ccff6f;
  --ansi-12: #00ff88;
  --ansi-13: #80ffaa;
  --ansi-14: #55ffaa;
  --ansi-15: #d0ffd0;
}
`,
};

export default theme;
