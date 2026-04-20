import { red } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';
import type { Ctx } from '../core/shell.js';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatMtime = (d: Date): string => {
  const mo = MONTHS[d.getMonth()] as string;
  const day = String(d.getDate()).padStart(2, ' ');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mo} ${day} ${hh}:${mm}`;
};

const PANIC_LINES = [
  '',
  '[  ---  KERNEL PANIC  ---  ]',
  '',
  'Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009',
  'CPU: 0 PID: 1 Comm: init Not tainted 6.11.5-arch1-1 #1',
  'Hardware name: Framework Laptop 13 (AMD Ryzen AI 300 Series)/FRANMDCP09, BIOS 03.03 2024',
  'Call Trace:',
  '  <TASK>',
  '  dump_stack_lvl+0x44/0x5c',
  '  panic+0x196/0x2f4',
  '  do_exit.cold+0x14/0x14',
  '  do_group_exit+0x2d/0x90',
  '  __x64_sys_exit_group+0x14/0x20',
  '  do_syscall_64+0x37/0x90',
  '  entry_SYSCALL_64_after_hwframe+0x63/0xcd',
  '  </TASK>',
  '',
  'Kernel Offset: 0x1e600000 from 0xffffffff81000000',
  '---[ end Kernel panic - not syncing ]---',
];

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/uname', {
    describe: 'print system information',
    exec(ctx) {
      const flag = ctx.argv[1];
      if (flag && flag !== '-a') {
        ctx.out(`uname: invalid option -- '${flag.replace(/^-/, '')}'\n`);
        return 1;
      }
      const hostname = kernel.identity.current().hostname;
      ctx.out(
        `Linux ${hostname} 6.11.5-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n`
      );
      return 0;
    },
  });

  kernel.installExecutable('/bin/date', {
    describe: 'current date and time',
    exec(ctx) {
      ctx.out(new Date().toString() + '\n');
      return 0;
    },
  });

  kernel.installExecutable('/bin/who', {
    describe: 'show who is logged in',
    exec(ctx) {
      const timestamp = formatMtime(new Date());
      const hostname = kernel.identity.current().hostname;
      const hostCol = hostname.padEnd(18).slice(0, 18);
      ctx.out(
        [
          `guest      pts/0   ${hostCol}  ${timestamp}`,
          'condor     pts/1   2600.net            Apr 16 03:14',
          'optik      pts/2   legion-of-doom.bbs  Jan  8 03:00',
          'cuckoo     pts/3   lbl.gov             Aug 12 02:30',
          'k4         pts/4   192.168.1.42        Apr 16 03:14',
        ].join('\n') + '\n'
      );
      return 0;
    },
  });

  kernel.installExecutable('/bin/ps', {
    describe: 'report process status',
    exec(ctx) {
      const processes = [
        { pid: 1, tty: '?', time: '00:00:01', cmd: '/sbin/init' },
        { pid: 2, tty: '?', time: '00:00:00', cmd: '[kthreadd]' },
        {
          pid: 120,
          tty: '?',
          time: '00:00:00',
          cmd: '/usr/lib/systemd/systemd-journald',
        },
        {
          pid: 135,
          tty: '?',
          time: '00:00:00',
          cmd: '/usr/lib/systemd/systemd-udevd',
        },
        {
          pid: 312,
          tty: '?',
          time: '00:00:00',
          cmd: '/usr/lib/systemd/systemd-logind',
        },
        {
          pid: 340,
          tty: '?',
          time: '00:00:01',
          cmd: '/usr/bin/NetworkManager --no-daemon',
        },
        { pid: 1337, tty: '?', time: '00:00:00', cmd: '/usr/sbin/sshd' },
        { pid: 8192, tty: 'pts/0', time: '00:00:00', cmd: '-bash' },
        { pid: 8193, tty: 'pts/0', time: '00:00:00', cmd: 'ps' },
      ];
      const header = `${'PID'.padStart(6)} ${'TTY'.padEnd(12)} ${'TIME'.padStart(8)} CMD`;
      const rows = processes.map(
        p =>
          `${String(p.pid).padStart(6)} ${p.tty.padEnd(12)} ${p.time.padStart(8)} ${p.cmd}`
      );
      ctx.out([header, ...rows].join('\n') + '\n');
      return 0;
    },
  });

  const panic = async (ctx: Ctx): Promise<void> => {
    for (const line of PANIC_LINES) {
      ctx.out(red(line || '\u00a0') + '\n');
      await ctx.sleep(80);
    }
    await ctx.sleep(2000);
    await kernel.reboot();
  };

  kernel.installExecutable('/bin/kill', {
    describe: 'send a signal to a process',
    async exec(ctx) {
      const args = ctx.argv.slice(1);
      const nonFlags = args.filter(a => !a.startsWith('-'));
      if (nonFlags.length === 0) {
        ctx.out(
          'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid ...\n'
        );
        return 1;
      }
      for (const arg of nonFlags) {
        if (!/^\d+$/.test(arg)) {
          ctx.out(`kill: ${arg}: arguments must be process or job IDs\n`);
          return 1;
        }
      }
      const pids = nonFlags.map(n => parseInt(n, 10));
      if (pids.includes(1) && kernel.identity.current().name === 'root') {
        await panic(ctx);
        return 0;
      }
      ctx.out(
        pids.map(pid => `kill: (${pid}) - Operation not permitted`).join('\n') +
          '\n'
      );
      return 1;
    },
  });

  kernel.installExecutable('/bin/restart', {
    describe: 'reboot the system',
    async exec() {
      await kernel.reboot();
      return 0;
    },
  });
};

export default install;
