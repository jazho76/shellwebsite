import { bold, dim, yellow } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';

const GITHUB_USER = 'jazho76';
const API = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`;
const DEFAULT_N = 10;

type Repo = {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
};

let cache: Repo[] | null = null;
let inflight: Promise<Repo[]> | null = null;

const fetchRepos = async (): Promise<Repo[]> => {
  if (cache) {
    return cache;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    const res = await fetch(API, { cache: 'no-cache' });
    if (res.status === 403) {
      throw new Error('rate-limited');
    }
    if (!res.ok) {
      throw new Error(`http ${res.status}`);
    }
    const all = (await res.json()) as Repo[];
    cache = all.filter(r => !r.fork && !r.archived);
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

const sanitize = (s: string): string => s.replace(/[[\]{}()]/g, '');

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/projects', {
    describe: 'top public github repos by stars',
    async exec(ctx) {
      const arg = ctx.argv[1];
      let limit = DEFAULT_N;
      if (arg !== undefined) {
        if (arg === 'all') {
          limit = Infinity;
        } else {
          const n = Number(arg);
          if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
            ctx.stderr(`projects: ${arg}: not a valid count\n`);
            return 1;
          }
          limit = n;
        }
      }

      if (cache === null) {
        ctx.stdout(dim('Loading some GitHub repositories…') + '\n');
      }

      let repos: Repo[];
      try {
        repos = await fetchRepos();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'rate-limited') {
          ctx.stderr(
            'projects: github API rate-limited (60/hr unauthenticated)\n'
          );
        } else {
          ctx.stderr('projects: cannot reach github (check your connection)\n');
        }
        return 1;
      }

      if (repos.length === 0) {
        ctx.stderr('projects: no public repositories\n');
        return 1;
      }

      const starred = repos
        .filter(r => r.stargazers_count > 0)
        .sort((a, b) => b.stargazers_count - a.stargazers_count);
      const recent = repos
        .filter(r => r.stargazers_count === 0)
        .sort(
          (a, b) =>
            new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
        );
      const displayed = [...starred, ...recent].slice(0, limit);

      const lines: string[] = [];
      for (const r of displayed) {
        const desc = r.description
          ? sanitize(r.description)
          : '(no description)';
        const link = bold(`[${r.name}](${r.html_url})`);
        const prefix =
          r.stargazers_count > 0
            ? yellow(`★  ${String(r.stargazers_count).padStart(3)}`) + '   '
            : dim('·') + '        ';
        lines.push(prefix + link);
        lines.push('         ' + dim(desc));
        lines.push('');
      }
      if (lines.length && lines[lines.length - 1] === '') {
        lines.pop();
      }
      ctx.stdout(lines.join('\n') + '\n');
      return 0;
    },
  });
};

export default install;
