import type { PluginInstall } from '../core/kernel.js';
import { dir, file, treeMount } from '../core/vfs.js';
import { system } from '../system.js';

const LOADAVG = '0.42 0.35 0.31 2/87 4823';

const buildMeminfo = (): string => {
  const memTotalKB = system.hardware.memoryMB * 1024;
  const memFreeKB = Math.round(memTotalKB * 0.45);
  const memAvailableKB = Math.round(memTotalKB * 0.83);
  const buffersKB = Math.round(memTotalKB * 0.004);
  const cachedKB = Math.round(memTotalKB * 0.19);
  const swapTotalKB = 2 * 1024 * 1024;
  const fmt = (n: number) => String(n).padStart(10, ' ');
  return (
    `MemTotal:       ${fmt(memTotalKB)} kB\n` +
    `MemFree:        ${fmt(memFreeKB)} kB\n` +
    `MemAvailable:   ${fmt(memAvailableKB)} kB\n` +
    `Buffers:        ${fmt(buffersKB)} kB\n` +
    `Cached:         ${fmt(cachedKB)} kB\n` +
    `SwapTotal:      ${fmt(swapTotalKB)} kB\n` +
    `SwapFree:       ${fmt(swapTotalKB)} kB`
  );
};

const CMDLINE = `BOOT_IMAGE=/boot/vmlinuz-${system.kernel.version} root=UUID=cafebabe-1337-beef rw quiet splash`;

const install: PluginInstall = kernel => {
  const buildProc = () =>
    dir({
      version: file(
        `Linux version ${system.kernel.version} (${system.kernel.buildHost}) (${system.kernel.compiler}) ${system.kernel.build}`
      ),
      cpuinfo: file(
        'processor\t: 0\n' +
          `vendor_id\t: ${system.hardware.cpu.vendor}\n` +
          `cpu family\t: ${system.hardware.cpu.family}\n` +
          `model\t\t: ${system.hardware.cpu.modelId}\n` +
          `model name\t: ${system.hardware.cpu.model}\n` +
          `cpu MHz\t\t: ${system.hardware.cpu.mhz.toFixed(3)}\n` +
          `cache size\t: ${system.hardware.cpu.cacheKB} KB\n` +
          `cpu cores\t: ${system.hardware.cpu.cores}\n` +
          `siblings\t: ${system.hardware.cpu.threads}`
      ),
      uptime: file(() => {
        const seconds = Math.floor((Date.now() - kernel.getBootTime()) / 1000);
        return seconds + ' seconds';
      }),
      loadavg: file(LOADAVG),
      meminfo: file(buildMeminfo()),
      mounts: file(() =>
        kernel.vfs
          .listMounts()
          .map(p => `none ${p} tmpfs rw 0 0`)
          .join('\n')
      ),
      cmdline: file(CMDLINE),
    });

  kernel.registerMount(treeMount('/proc', buildProc));
};

export default install;
