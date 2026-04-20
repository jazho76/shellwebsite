import type { PluginInstall } from '../core/kernel.js';
import { DEFAULT_THEME, themes } from '../themes/index.js';

const injectThemeStyles = () => {
  const style = document.createElement('style');
  style.setAttribute('data-plugin', 'theme');
  style.textContent = themes.map(t => t.css).join('\n');
  document.head.append(style);
};

const applyTheme = (name: string) => {
  document.body.dataset.theme = name;
};

const currentThemeName = (): string =>
  document.body.dataset.theme ?? DEFAULT_THEME;

const install: PluginInstall = kernel => {
  injectThemeStyles();
  applyTheme(DEFAULT_THEME);

  kernel.installExecutable('/bin/theme', {
    describe: 'list or switch themes',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      if (args.length === 0) {
        const current = currentThemeName();
        const width = Math.max(...themes.map(t => t.name.length));
        const lines = themes.map(
          t =>
            `${t.name === current ? '* ' : '  '}${t.name.padEnd(width + 2)}${t.describe}`
        );
        ctx.out(lines.join('\n') + '\n');
        return 0;
      }
      const target = args[0] as string;
      const found = themes.find(t => t.name === target);
      if (!found) {
        ctx.stderr(`theme: unknown theme '${target}'\n`);
        return 1;
      }
      applyTheme(found.name);
      return 0;
    },
  });
};

export default install;
