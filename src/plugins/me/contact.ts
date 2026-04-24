import { dim } from '../../core/color.js';
import type { PluginInstall } from '../../core/kernel.js';
import { aliasCat } from '../../core/shell.js';
import { asGuest, file } from '../../core/vfs.js';

const contactText =
  `${dim('# edit src/plugins/me/contact.ts to set your links')}\n` +
  `${dim('email    ')}[you@example.com](mailto:you@example.com)\n` +
  `${dim('github   ')}[github.com/<user>](https://github.com/<user>)\n` +
  `${dim('linkedin ')}[linkedin.com/in/<you>](https://linkedin.com/in/<you>)\n` +
  `${dim('twitter  ')}[twitter.com/<user>](https://twitter.com/<user>)`;

const install: PluginInstall = kernel => {
  kernel.vfs.appendDir('/home/guest', {
    'contact.txt': asGuest(file(contactText)),
  });

  kernel.installExecutable('/bin/contact', {
    describe: 'contact info',
    exec: aliasCat('~/contact.txt'),
  });
};

export default install;
