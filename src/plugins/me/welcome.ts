import { bold, brightCyan, dim, green } from '../../core/color.js';
import type { PluginInstall } from '../../core/kernel.js';

const bullet = dim('-');
const cmd = brightCyan;
const section = green;

const CONTENT: string[] = [
  '',
  bold('welcome to shellsite'),
  dim(
    'a static portfolio that looks and feels like a real shell. your bio, links,'
  ),
  dim(
    'and projects are served as commands and files. everything runs in the browser.'
  ),
  '',
  section('make it yours'),
  `${bullet} src/config.ts              github user, posthog key, hostname, tab title`,
  `${bullet} src/plugins/me/welcome.ts  this screen`,
  `${bullet} src/plugins/me/about.ts    ${cmd('about')} command + ~/about.txt`,
  `${bullet} src/plugins/me/contact.ts  ~/contact.txt`,
  `${bullet} src/themes/index.ts        DEFAULT_THEME`,
  `${bullet} src/system.ts              fictional os/hardware identity (optional)`,
  '',
  section('try it'),
  `${bullet} ${cmd('about')}, ${cmd('projects')}, ${cmd('help')}       content commands`,
  `${bullet} ${cmd('ls ~')}, ${cmd('cat ~/contact.txt')}     browse the vfs`,
  `${bullet} ${cmd('theme')} <name>                swap palette at runtime`,
  `${bullet} ${cmd('find / -type f')}              poke around`,
  '',
  dim(
    'source: [github.com/jazho76/shellwebsite](https://github.com/jazho76/shellwebsite)'
  ),
];

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/welcome', {
    describe: 'portfolio overview',
    exec(ctx) {
      ctx.stdout(CONTENT.join('\n') + '\n');
      return 0;
    },
  });
};

export default install;
