const ESC = '\x1b';

const fg = (on: string) => (s: string) => `${ESC}[${on}m${s}${ESC}[39m`;
const bg = (on: string) => (s: string) => `${ESC}[${on}m${s}${ESC}[49m`;
const attr = (on: string, off: string) => (s: string) =>
  `${ESC}[${on}m${s}${ESC}[${off}m`;

export const black = fg('30');
export const red = fg('31');
export const green = fg('32');
export const yellow = fg('33');
export const blue = fg('34');
export const magenta = fg('35');
export const cyan = fg('36');
export const white = fg('37');

export const brightRed = fg('91');
export const brightGreen = fg('92');
export const brightYellow = fg('93');
export const brightBlue = fg('94');
export const brightMagenta = fg('95');
export const brightCyan = fg('96');

export const bgRed = bg('41');

export const bold = attr('1', '22');
export const dim = attr('2', '22');
export const italic = attr('3', '23');
export const underline = attr('4', '24');
export const inverse = attr('7', '27');
export const strike = attr('9', '29');
