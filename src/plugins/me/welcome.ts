import { bold, brightCyan, dim, green } from '../../core/color.js';
import type { PluginInstall } from '../../core/kernel.js';

const bullet = dim('-');
const cmd = brightCyan;
const section = green;

const CONTENT: string[] = [
  '',
  bold('joaquin pinillos'),
  dim('software engineer: systems, low-level, tooling'),
  '',
  section('background'),
  `${bullet} c/c++, x86, systems`,
  `${bullet} frontend/backend (typescript, nodejs, .net)`,
  '',
  section('current focus'),
  `${bullet} frontend platform at Forge (startup)`,
  `${bullet} platform development`,
  `${bullet} systems programming`,
  `${bullet} security and exploitation`,
  `${bullet} understanding abstractions by breaking them`,
  '',
  section('approach'),
  `${bullet} prefer understanding systems over using abstractions blindly`,
  `${bullet} build small experiments to internalize concepts`,
  `${bullet} iterate: explore → understand → implement`,
  '',
  section('reach'),
  `${bullet} github:   [github.com/jazho76](https://github.com/jazho76)`,
  `${bullet} linkedin: [linkedin.com/in/joaquin-pinillos](https://linkedin.com/in/joaquin-pinillos)`,
  `${bullet} email:    [hello@jpinillos.dev](mailto:hello@jpinillos.dev)`,
  '',
  section('tip'),
  `${bullet} try: ${cmd('about')}, ${cmd('projects')}, ${cmd('help')}`,
  '',
  dim(
    'source code for this terminal lives at [github.com/jazho76/shellwebsite](https://github.com/jazho76/shellwebsite)'
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
