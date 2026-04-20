import { red } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';
import type { Ctx } from '../core/shell.js';

const CSS = `
body.rm-egg-invert .terminal { filter: invert(1) hue-rotate(180deg); }
body.rm-egg-shutdown .terminal {
  transform-origin: center center;
  animation: rmEggShutdown 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes rmEggShutdown {
  0%   { transform: scaleY(1) scaleX(1); filter: brightness(1); background: transparent; }
  20%  { transform: scaleY(0.02) scaleX(1.05); filter: brightness(4); background: #fff; }
  50%  { transform: scaleY(0.005) scaleX(0.3); filter: brightness(3); background: #fff; }
  80%  { transform: scale(0); filter: brightness(2); background: #fff; }
  100% { transform: scale(0); opacity: 0; }
}
`;

const injectStyle = () => {
  const style = document.createElement('style');
  style.setAttribute('data-plugin', 'rm-egg');
  style.textContent = CSS;
  document.head.append(style);
};

const parseFlags = (args: string[]): Set<string> => {
  const flags = new Set<string>();
  for (const a of args) {
    if (!a.startsWith('-') || a === '-') {
      continue;
    }
    for (const c of a.slice(1)) {
      flags.add(c);
    }
  }
  return flags;
};

const EGG_ERRORS = [
  '[ 42.131] EXT4-fs error (device nvme0n1p2): ext4_lookup:1611: comm rm: deleted inode referenced: 9',
  '[ 42.132] I/O error, dev nvme0n1, sector 1337 op 0x1:(WRITE) flags 0x8800 phys_seg 1',
  '[ 42.140] Buffer I/O error on device nvme0n1p2, logical block 0',
  '[ 42.145] Aborting journal on device nvme0n1p2-8.',
  "[ 42.151] systemd[1]: local-fs.target: Failed with result 'exit-code'.",
];
const ERROR_TICKS = [8, 16, 24, 32, 40];
const TICK_MS = 80;
const TOTAL_TICKS = 50;

const install: PluginInstall = kernel => {
  injectStyle();

  const runEgg = async (ctx: Ctx, cmdText: string): Promise<number> => {
    for (let tick = 0; tick < TOTAL_TICKS; tick++) {
      const intensity = 0.05 + (tick / TOTAL_TICKS) * 0.9;
      ctx.term.corrupt(intensity);

      const errIdx = ERROR_TICKS.indexOf(tick);
      if (errIdx !== -1) {
        ctx.out(red(EGG_ERRORS[errIdx] as string) + '\n');
      }

      if (tick > 0 && tick % 4 === 0) {
        ctx.term.toggleClass('rm-egg-invert', true);
        setTimeout(() => ctx.term.toggleClass('rm-egg-invert', false), TICK_MS);
      }

      await ctx.sleep(TICK_MS);
    }

    ctx.term.toggleClass('rm-egg-invert', false);
    ctx.term.toggleClass('rm-egg-shutdown', true);
    await ctx.sleep(650);
    ctx.term.clear();
    await ctx.sleep(1200);
    ctx.term.toggleClass('rm-egg-shutdown', false);
    ctx.term.appendEntry(cmdText, 'just kidding. everything is fine.\n');
    return 0;
  };

  kernel.installExecutable('/bin/rm', {
    describe: 'remove files or directories',
    async exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const paths = args.filter(a => !a.startsWith('-'));
      const recurse = flags.has('r') || flags.has('R');
      const force = flags.has('f');

      if (paths.length === 0) {
        ctx.out('rm: missing operand\n');
        return 1;
      }

      const eggTrigger =
        recurse && force && paths.some(p => p === '/' || p === '/*');
      if (eggTrigger) {
        return await runEgg(ctx, ctx.raw);
      }

      const errors: string[] = [];
      for (const p of paths) {
        const result = ctx.fs.rm(p, { recurse });
        if (result.ok) {
          continue;
        }
        const msg: Record<string, string> = {
          EROOT: `rm: it is dangerous to operate recursively on '/'`,
          EACCES: `rm: cannot remove '${p}': Permission denied`,
          EISDIR: `rm: cannot remove '${p}': Is a directory`,
          ENOENT: `rm: cannot remove '${p}': No such file or directory`,
        };
        if (result.error === 'ENOENT' && force) {
          continue;
        }
        errors.push(
          msg[result.error] ?? `rm: cannot remove '${p}': ${result.error}`
        );
      }

      const cwdCheck = ctx.fs.resolve(kernel.getCwd());
      if (!cwdCheck.ok || cwdCheck.node.type !== 'dir') {
        kernel.setCwd('/');
      }

      if (errors.length) {
        ctx.out(errors.join('\n') + '\n');
        return 1;
      }
      return 0;
    },
  });
};

export default install;
