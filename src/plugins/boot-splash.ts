import { brightCyan, dim, green } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';

type LineStep = { type: 'line'; text: string };
type DelayStep = { type: 'delay'; ms: number };
type CounterStep = {
  type: 'counter';
  prefix: string;
  from: number;
  to: number;
  step: number;
  unit: string;
  done: string;
  delay: number;
};
type BootStep = LineStep | DelayStep | CounterStep;

const BOOT_STEPS: BootStep[] = [
  {
    type: 'line',
    text: 'InsydeH2O UEFI Firmware v03.03  (c) 2024, Insyde Software Corp.',
  },
  { type: 'line', text: 'Framework Laptop 13 (AMD Ryzen AI 300 Series)' },
  { type: 'line', text: '' },
  { type: 'delay', ms: 120 },
  {
    type: 'line',
    text: 'CPU    : AMD Ryzen AI 9 HX 370 w/ Radeon 890M @ 5.1 GHz',
  },
  {
    type: 'line',
    text: `Cache  : L1 768K, L2 12M, L3 24M  ${green('Enabled')}`,
  },
  {
    type: 'counter',
    prefix: 'Memory : Testing ... ',
    from: 0,
    to: 32768,
    step: 2048,
    unit: 'M',
    done: `M ${green('OK')}`,
    delay: 28,
  },
  { type: 'line', text: '' },
  { type: 'delay', ms: 150 },
  { type: 'line', text: 'Detecting NVMe devices ...' },
  { type: 'line', text: '  NVMe 0   : WD_BLACK SN770 1TB' },
  { type: 'line', text: `  NVMe 1   : ${dim('<None>')}` },
  { type: 'line', text: '' },
  { type: 'line', text: 'USB Device(s)    : 1 Keyboard' },
  { type: 'line', text: `Auto-Detecting PCI ... ${green('Done')}` },
  { type: 'line', text: '' },
  { type: 'line', text: 'System BIOS shadowed' },
  { type: 'line', text: 'Video BIOS shadowed' },
  { type: 'line', text: `POST completed ${green('successfully')}` },
  { type: 'delay', ms: 500 },
  { type: 'line', text: '' },
  { type: 'line', text: 'Booting from Hard Disk ...' },
  { type: 'delay', ms: 200 },
  { type: 'line', text: 'Loading shellwebsite ...' },
  { type: 'delay', ms: 250 },
  { type: 'line', text: '' },
  {
    type: 'line',
    text: `${brightCyan('welcome.')} type \`help\` for a list of commands.`,
  },
];

const BOOT_LINE_DELAY = 35;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const install: PluginInstall = kernel => {
  const { term } = kernel;

  const runCounter = async (step: CounterStep) => {
    const line = term.emitLine(step.prefix, 'boot-line');
    for (let v = step.from; v <= step.to; v += step.step) {
      line.textContent = `${step.prefix}${v}${step.unit}`;
      await sleep(step.delay);
    }
    term.setLineContent(line, `${step.prefix}${step.to}${step.done}`);
  };

  const runBootSteps = async () => {
    for (const step of BOOT_STEPS) {
      if (step.type === 'line') {
        term.emitLine(step.text, 'boot-line');
        await sleep(BOOT_LINE_DELAY);
      } else if (step.type === 'counter') {
        await runCounter(step);
        await sleep(BOOT_LINE_DELAY);
      } else if (step.type === 'delay') {
        await sleep(step.ms);
      }
    }
  };

  const greet = async () => {
    term.spacer();
    await term.fakeType('welcome', 50);
    term.spacer();
    term.setPromptVisible(true);
  };

  kernel.on('boot-ready', async ({ isReboot }) => {
    term.setBusy(true);
    try {
      if (isReboot) {
        await runBootSteps();
      }
      await greet();
    } finally {
      term.setBusy(false);
      term.focusInput();
    }
  });
};

export default install;
