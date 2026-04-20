import { cyan, green, red, yellow } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';
import { dir, file, GUEST, treeMount } from '../core/vfs.js';

const elfJunk = (): string => {
  const header = '\x7fELF\x02\x01\x01\x00';
  const glyphs =
    '\u2588\u2591\u2592\u2593\u00b6\u00a7\u00d7\u03a3\u0416\u042f\u30c4\u4e71\ufffd';
  const lines = [header];
  for (let i = 0; i < 12; i++) {
    let line = '';
    for (let j = 0; j < 64; j++) {
      const r = Math.random();
      if (r < 0.3) {
        line += String.fromCharCode(0x20 + Math.floor(Math.random() * 95));
      } else if (r < 0.6) {
        line += glyphs[Math.floor(Math.random() * glyphs.length)];
      } else {
        line += String.fromCharCode(Math.floor(Math.random() * 26) + 0x41);
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
};

const buildTmp = () =>
  dir(
    {
      '.secret': file('you were curious enough to check /tmp. respect.'),
      '.pwn': Object.assign(
        file(elfJunk, undefined, { owner: GUEST, group: GUEST, mode: 0o755 }),
        { executable: true }
      ),
    },
    { mode: 0o777 }
  );

const PWN_LINES: Array<{ text: string; delay: number }> = [
  { text: '$ file /bin/login', delay: 300 },
  {
    text: 'login: ELF 64-bit LSB executable, x86-64, dynamically linked, not stripped',
    delay: 150,
  },
  { text: '$ checksec --file=/bin/login', delay: 300 },
  { text: '    Arch:     amd64-64-little', delay: 40 },
  { text: `    RELRO:    ${yellow('Partial RELRO')}`, delay: 40 },
  { text: `    Stack:    ${red('No canary found')}`, delay: 40 },
  { text: `    NX:       ${green('NX enabled')}`, delay: 40 },
  { text: `    PIE:      ${red('No PIE')}`, delay: 40 },
  {
    text: "$ python3 -c \"print('A'*72 + 'BBBBBBBB')\" | /bin/login",
    delay: 400,
  },
  { text: 'Segmentation fault (core dumped)', delay: 200 },
  { text: '$ dmesg | tail -1', delay: 300 },
  {
    text: '[42069.1337] login[8192]: segfault at 4242424242424242 ip 4242424242424242 sp 00007fffffffe0a0 error 14 in login[400000+1000]',
    delay: 150,
  },
  { text: `${cyan('[*]')} RIP overwrite confirmed at offset 72`, delay: 150 },
  { text: `${cyan('[*]')} NX enabled -- building ROP chain`, delay: 200 },
  { text: '$ ropper --file /bin/login --search "pop rdi; ret"', delay: 400 },
  { text: '0x0000000000401263: pop rdi; ret;', delay: 150 },
  { text: '$ objdump -d /bin/login | grep system@plt', delay: 400 },
  { text: '0x401050 <system@plt>:', delay: 150 },
  { text: '$ strings -t x /bin/login | grep /bin/sh', delay: 300 },
  { text: '  4020a0 /bin/sh', delay: 150 },
  { text: `${cyan('[*]')} gadgets:`, delay: 100 },
  { text: '    pop_rdi  = 0x401263', delay: 60 },
  { text: '    bin_sh   = 0x4020a0', delay: 60 },
  { text: '    system   = 0x401050', delay: 60 },
  {
    text: `${cyan('[*]')} crafting payload: padding(72) + pop_rdi + &"/bin/sh" + system`,
    delay: 200,
  },
  { text: `${cyan('[*]')} sending exploit ...`, delay: 400 },
  { text: '$ id', delay: 200 },
  { text: 'uid=0(root) gid=0(root)', delay: 150 },
];

const install: PluginInstall = kernel => {
  kernel.registerMount(treeMount('/tmp', buildTmp));

  kernel.installExecutable('/tmp/.pwn', {
    async exec(ctx) {
      for (const line of PWN_LINES) {
        ctx.out(line.text + '\n');
        await ctx.sleep(line.delay);
      }
      kernel.identity.switchTo('root');
      kernel.setCwd('/root');
      return 0;
    },
  });
};

export default install;
