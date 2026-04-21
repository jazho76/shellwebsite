import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

function git(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const commitCount = git('rev-list --count HEAD');
if (commitCount) {
  process.env.VITE_APP_VERSION = `1.0.${commitCount}`;
}
const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? git('rev-parse HEAD');
if (commit) {
  process.env.VITE_APP_COMMIT = commit;
}

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
  },
  test: {
    include: ['../tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
