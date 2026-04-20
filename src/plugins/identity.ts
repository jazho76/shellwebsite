import type { PluginInstall } from '../core/kernel.js';
import { HOME } from '../core/vfs.js';

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/whoami', {
    describe: 'print current user',
    exec(ctx) {
      ctx.out(kernel.identity.current().name + '\n');
      return 0;
    },
  });

  kernel.installExecutable('/bin/id', {
    describe: 'print user identity',
    exec(ctx) {
      const id = kernel.identity.current();
      ctx.out(
        `uid=${id.uid}(${id.name}) gid=${id.gid}(${id.name}) groups=${id.gid}(${id.name})\n`
      );
      return 0;
    },
  });

  kernel.installExecutable('/bin/exit', {
    describe: 'end the session',
    exec(ctx) {
      if (kernel.identity.current().name === 'root') {
        kernel.identity.switchTo('guest');
        kernel.setCwd(HOME);
        ctx.out('logout\n');
        return 0;
      }
      const hostname = kernel.identity.current().hostname;
      ctx.out('logout\n');
      ctx.out(`Connection to ${hostname} closed.\n`);
      kernel.term.lockSession();
      return 0;
    },
  });
};

export default install;
