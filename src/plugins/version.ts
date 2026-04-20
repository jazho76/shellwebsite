import type { PluginInstall } from '../core/kernel.js';

const VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
const COMMIT = (import.meta.env.VITE_APP_COMMIT ?? 'local').slice(0, 7);

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/version', {
    describe: 'print application version',
    exec(ctx) {
      ctx.out(`jpinillos.dev ${VERSION} (${COMMIT})\n`);
      return 0;
    },
  });
};

export default install;
