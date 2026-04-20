import type { Theme } from './index.js';

const theme: Theme = {
  name: 'crt',
  describe: 'green phosphor with scanlines',
  css: `
body[data-theme="crt"] {
  --bg: #161616;
  --fg: #33ff33;
  --prompt-host: #33ff33;
  --prompt-cwd: #20aa20;
  --link: #33ff33;
  --cursor-bg: #33ff33;
  --cursor-fg: #161616;
  --text-shadow: 0 0 5px rgba(51, 255, 51, 0.5);

  --ansi-0: #041a04;
  --ansi-1: #ff3333;
  --ansi-2: #33ff33;
  --ansi-3: #aaff33;
  --ansi-4: #33aa33;
  --ansi-5: #88ff88;
  --ansi-6: #55cc55;
  --ansi-7: #bbffbb;
  --ansi-8: #1a8a1a;
  --ansi-9: #ff6666;
  --ansi-10: #66ff66;
  --ansi-11: #ccff66;
  --ansi-12: #66cc66;
  --ansi-13: #aaffaa;
  --ansi-14: #88dd88;
  --ansi-15: #ddffdd;
}

body[data-theme="crt"]::after {
  content: "";
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15) 0px,
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
  z-index: 9999;
}
`,
};

export default theme;
