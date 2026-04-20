import type { PluginInstall } from '../core/kernel.js';

const ESC = '\x1b';
const sgr = (...params: (number | string)[]) => `${ESC}[${params.join(';')}m`;
const reset = sgr(0);

const BASIC_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
];

const basicLine = (label: string, base: number): string => {
  const cells = BASIC_NAMES.map((_, i) => {
    const code = base + i;
    return `${sgr(code)} ${String(code).padStart(3)} ${reset}`;
  });
  return `${label.padEnd(10)}${cells.join('')}`;
};

const attrsLine = (): string => {
  const samples: [string, string][] = [
    ['bold', sgr(1) + 'bold' + reset],
    ['dim', sgr(2) + 'dim' + reset],
    ['italic', sgr(3) + 'italic' + reset],
    ['underline', sgr(4) + 'underline' + reset],
    ['inverse', sgr(7) + 'inverse' + reset],
    ['strike', sgr(9) + 'strike' + reset],
  ];
  return samples.map(([, s]) => s).join('  ');
};

const palette256 = (): string => {
  const rows: string[] = [];
  const chunk = (from: number, to: number, perRow: number) => {
    const out: string[] = [];
    for (let i = from; i <= to; i++) {
      out.push(`${sgr(38, 5, i)}${String(i).padStart(3)}${reset}`);
      if ((i - from + 1) % perRow === 0) {
        out.push('\n');
      } else {
        out.push(' ');
      }
    }
    return out.join('').replace(/ $/, '');
  };
  rows.push(chunk(16, 231, 18));
  rows.push(chunk(232, 255, 12));
  return rows.join('\n');
};

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/colortest', {
    describe: 'show all ansi colors and attributes',
    exec(ctx) {
      const lines = [
        basicLine('fg', 30),
        basicLine('fg bright', 90),
        basicLine('bg', 40),
        basicLine('bg bright', 100),
        '',
        '256-color palette:',
        palette256(),
        '',
        'attributes: ' + attrsLine(),
        '',
        `24-bit rgb: ${sgr(38, 2, 255, 128, 0)}#ff8000${reset}  ${sgr(38, 2, 80, 200, 255)}#50c8ff${reset}`,
      ];
      ctx.stdout(lines.join('\n') + '\n');
      return 0;
    },
  });
};

export default install;
