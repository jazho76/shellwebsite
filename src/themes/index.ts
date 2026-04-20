import cappuccino from './cappuccino.js';
import crt from './crt.js';
import dracula from './dracula.js';
import graphite from './graphite.js';
import gruvbox from './gruvbox.js';
import jazho76 from './jazho76.js';
import matrix from './matrix.js';
import nord from './nord.js';
import synthwave from './synthwave.js';
import tokyoNight from './tokyo-night.js';

export type Theme = {
  name: string;
  describe: string;
  /** CSS scoped to `body[data-theme="<name>"]`. */
  css: string;
  /** URL for a body background image. Typically an imported asset. */
  backgroundImage?: string;
  /** Translucent color for a full-viewport overlay over the background image. */
  overlayBackground?: string;
  /** Backdrop blur amount for the overlay. */
  overlayBlur?: string;
};

export const themes: readonly Theme[] = [
  cappuccino,
  crt,
  dracula,
  graphite,
  gruvbox,
  jazho76,
  matrix,
  nord,
  synthwave,
  tokyoNight,
];

/** Edit this to swap the out-of-box palette. */
export const DEFAULT_THEME: Theme['name'] = jazho76.name;
