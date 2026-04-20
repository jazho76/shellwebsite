import cappuccino from './cappuccino.js';
import crt from './crt.js';
import dracula from './dracula.js';
import graphite from './graphite.js';
import gruvbox from './gruvbox.js';
import matrix from './matrix.js';
import nord from './nord.js';
import synthwave from './synthwave.js';
import tokyoNight from './tokyo-night.js';

export type Theme = {
  name: string;
  describe: string;
  /** CSS scoped to `body[data-theme="<name>"]`. */
  css: string;
};

export const themes: readonly Theme[] = [
  cappuccino,
  crt,
  dracula,
  graphite,
  gruvbox,
  matrix,
  nord,
  synthwave,
  tokyoNight,
];

/** Edit this to swap the out-of-box palette. */
export const DEFAULT_THEME: Theme['name'] = tokyoNight.name;
