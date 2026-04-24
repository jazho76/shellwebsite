import type { PluginInstall } from '../core/kernel.js';
import bashHistory from './bash-history.js';
import bootSplash from './boot-splash.js';
import colortest from './colortest.js';
import coreutils from './coreutils.js';
import demo from './demo.js';
import dev from './dev.js';
import etc from './etc.js';
import find from './find.js';
import fortune from './fortune.js';
import fsutils from './fsutils.js';
import home from './home.js';
import identity from './identity.js';
import about from './me/about.js';
import contact from './me/contact.js';
import welcome from './me/welcome.js';
import posthog from './posthog.js';
import proc from './proc.js';
import projects from './projects.js';
import pwn from './pwn.js';
import rmEgg from './rm-egg.js';
import root from './root.js';
import sysinfo from './sysinfo.js';
import text from './text.js';
import theme from './theme.js';
import usr from './usr.js';
import varPlugin from './var.js';
import version from './version.js';

export const plugins: PluginInstall[] = [
  etc,
  home,
  root,
  usr,
  varPlugin,
  about,
  contact,
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
  demo,
];
