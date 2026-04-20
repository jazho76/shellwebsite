import type { PluginInstall } from '../../core/kernel.js';
import { aliasCat } from '../../core/shell.js';
import { asGuest, file } from '../../core/vfs.js';

const aboutText =
  'software engineer since 2004, experience in c/c++, x86 assembly, .net, java, nodejs, go and rust.\n' +
  'interests: systems, low-level, security, binary exploitation, infrastructure, tool development.';

const install: PluginInstall = kernel => {
  kernel.vfs.appendDir('/home/guest', {
    'about.txt': asGuest(file(aboutText)),
  });

  kernel.installExecutable('/bin/about', {
    describe: 'who is this',
    exec: aliasCat('~/about.txt'),
  });
};

export default install;
