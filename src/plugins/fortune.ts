import type { PluginInstall } from '../core/kernel.js';

const install: PluginInstall = kernel => {
  let lastIndex = -1;

  kernel.installExecutable('/bin/koan', {
    describe: 'wisdom',
    exec(ctx) {
      const result = ctx.fs.read('/usr/share/fortune/cookies');
      if (!result.ok) {
        ctx.out('koan: unavailable\n');
        return 1;
      }
      const lines = result.content.split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        return 0;
      }
      let index: number;
      do {
        index = Math.floor(Math.random() * lines.length);
      } while (index === lastIndex && lines.length > 1);
      lastIndex = index;
      ctx.out((lines[index] as string) + '\n');
      return 0;
    },
  });
};

export default install;
