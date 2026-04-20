import type { PluginInstall } from '../core/kernel.js';
import bashHistory from './bash-history.js';
import bootSplash from './boot-splash.js';
import colortest from './colortest.js';
import coreutils from './coreutils.js';
import dev from './dev.js';
import etc from './etc.js';
import find from './find.js';
import fortune from './fortune.js';
import fsutils from './fsutils.js';
import identity from './identity.js';
import posthog from './posthog.js';
import proc from './proc.js';
import projects from './projects.js';
import pwn from './pwn.js';
import rmEgg from './rm-egg.js';
import siteContent from './site-content.js';
import sysinfo from './sysinfo.js';
import text from './text.js';
import theme from './theme.js';
import version from './version.js';
import welcome from './welcome.js';

export const plugins: PluginInstall[] = [
  etc,
  siteContent,
  proc,
  dev,
  coreutils,
  fsutils,
  text,
  identity,
  pwn,
  sysinfo,
  theme,
  fortune,
  projects,
  colortest,
  welcome,
  find,
  version,
  bootSplash,
  bashHistory,
  posthog,
  rmEgg,
];
