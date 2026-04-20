import type { PluginInstall } from '../core/kernel.js';
import { dir, file, treeMount } from '../core/vfs.js';

const install: PluginInstall = kernel => {
  const buildProc = () =>
    dir({
      version: file(
        'Linux version 6.11.5-arch1-1 (linux@archlinux) (gcc (GCC) 14.2.1) #1 SMP PREEMPT_DYNAMIC'
      ),
      cpuinfo: file(
        'processor\t: 0\n' +
          'vendor_id\t: AuthenticAMD\n' +
          'cpu family\t: 26\n' +
          'model\t\t: 36\n' +
          'model name\t: AMD Ryzen AI 9 HX 370 w/ Radeon 890M\n' +
          'cpu MHz\t\t: 5100.000\n' +
          'cache size\t: 1024 KB\n' +
          'cpu cores\t: 12\n' +
          'siblings\t: 24'
      ),
      uptime: file(() => {
        const seconds = Math.floor((Date.now() - kernel.getBootTime()) / 1000);
        return seconds + ' seconds';
      }),
    });

  kernel.registerMount(treeMount('/proc', buildProc));
};

export default install;
