export const ROOT = 'root';
export const GUEST = 'guest';
export const HOME = '/home/guest';

export const ENOENT = 'ENOENT';
export const EACCES = 'EACCES';
export const EISDIR = 'EISDIR';
export const ENOTDIR = 'ENOTDIR';
export const EEXIST = 'EEXIST';
export const EROOT = 'EROOT';
export const ENOSYS = 'ENOSYS';
export const ENOSPC = 'ENOSPC';

export type VfsError =
  | typeof ENOENT
  | typeof EACCES
  | typeof EISDIR
  | typeof ENOTDIR
  | typeof EEXIST
  | typeof EROOT
  | typeof ENOSYS
  | typeof ENOSPC;

export type VfsFailure = { ok: false; error: VfsError; path?: string };
export type VfsOk<T = unknown> = { ok: true } & T;
export type VfsResult<T = unknown> = VfsOk<T> | VfsFailure;

export type NodeOpts = {
  owner?: string;
  group?: string;
  mode?: number;
};

export type FileContent = string | (() => string);

export type FileNode = {
  type: 'file';
  owner: string;
  group: string;
  mode: number;
  content: FileContent;
  fileType?: string;
  executable?: boolean;
};

export type DirNode = {
  type: 'dir';
  owner: string;
  group: string;
  mode: number;
  children: Record<string, VfsNode>;
};

export type VfsNode = FileNode | DirNode;

export type IdentityLike = { name: string };

export type RmOpts = { recurse?: boolean };

export type Mount = {
  path: string;
  resolve(rel: string): VfsNode | null;
  write?(rel: string, content: string, identity: IdentityLike): VfsResult;
  mkdir?(rel: string, identity: IdentityLike): VfsResult;
  rm?(rel: string, opts: RmOpts, identity: IdentityLike): VfsResult;
  rebuild?(): void;
};

export type ResolveResult = VfsResult<{
  abs: string;
  node: VfsNode;
  mount: Mount | undefined;
}>;
export type ListResult = VfsResult<{ entries: Array<[string, VfsNode]> }>;
export type ReadResult = VfsResult<{ content: string }>;
export type StatResult = VfsResult<{
  type: VfsNode['type'];
  owner: string;
  group: string;
  mode: number;
  node: VfsNode;
}>;

export type Vfs = {
  registerMount(mount: Mount): void;
  resetVfs(): void;
  resolve(pathStr: string, cwd: string, identity: IdentityLike): ResolveResult;
  read(pathStr: string, cwd: string, identity: IdentityLike): ReadResult;
  list(pathStr: string, cwd: string, identity: IdentityLike): ListResult;
  stat(pathStr: string, cwd: string, identity: IdentityLike): StatResult;
  write(
    pathStr: string,
    cwd: string,
    identity: IdentityLike,
    content: string
  ): VfsResult;
  mkdir(pathStr: string, cwd: string, identity: IdentityLike): VfsResult;
  rm(
    pathStr: string,
    cwd: string,
    identity: IdentityLike,
    opts?: RmOpts
  ): VfsResult;
  normalize(pathStr: string, cwd: string): string | null;
  displayPath(absolute: string): string;
  listMounts(): string[];
};

const fail = (error: VfsError, path?: string): VfsFailure =>
  path !== undefined ? { ok: false, error, path } : { ok: false, error };

const hasBit = (
  mode: number,
  user: string,
  owner: string,
  group: string,
  bit: number
): boolean => {
  if (user === ROOT) {
    return true;
  }
  if (user === owner) {
    return !!((mode >> 6) & bit);
  }
  if (user === group) {
    return !!((mode >> 3) & bit);
  }
  return !!(mode & bit);
};

export const canRead = (node: VfsNode, user: string): boolean =>
  hasBit(node.mode, user, node.owner, node.group, 4);
export const canWrite = (node: VfsNode, user: string): boolean =>
  hasBit(node.mode, user, node.owner, node.group, 2);
export const canExec = (node: VfsNode, user: string): boolean =>
  hasBit(node.mode, user, node.owner, node.group, 1);

export const dir = (
  children: Record<string, VfsNode>,
  opts: NodeOpts = {}
): DirNode => ({
  type: 'dir',
  owner: opts.owner ?? ROOT,
  group: opts.group ?? ROOT,
  mode: opts.mode ?? 0o755,
  children,
});

export const file = (
  content: FileContent,
  fileType?: string,
  opts: NodeOpts = {}
): FileNode => {
  const node: FileNode = {
    type: 'file',
    owner: opts.owner ?? ROOT,
    group: opts.group ?? ROOT,
    mode: opts.mode ?? 0o644,
    content,
  };
  if (fileType !== undefined) {
    node.fileType = fileType;
  }
  return node;
};

export const contentOf = (node: FileNode): string =>
  typeof node.content === 'function' ? node.content() : node.content;

export function treeMount(path: string, buildRoot: () => DirNode): Mount {
  let root = buildRoot();

  const walk = (rel: string): VfsNode | null => {
    if (rel === '' || rel === '/') {
      return root;
    }
    const parts = rel.split('/').filter(Boolean);
    let node: VfsNode = root;
    for (const p of parts) {
      if (node.type !== 'dir') {
        return null;
      }
      const next: VfsNode | undefined = node.children[p];
      if (!next) {
        return null;
      }
      node = next;
    }
    return node;
  };

  const parentOf = (rel: string): { parent: VfsNode; name: string } | null => {
    const parts = rel.split('/').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const name = parts.pop() as string;
    let node: VfsNode = root;
    for (const p of parts) {
      if (node.type !== 'dir') {
        return null;
      }
      const next: VfsNode | undefined = node.children[p];
      if (!next) {
        return null;
      }
      node = next;
    }
    return { parent: node, name };
  };

  return {
    path,
    resolve: walk,
    write(rel, content, identity) {
      const pos = parentOf(rel);
      if (!pos) {
        return fail(ENOENT);
      }
      const { parent, name } = pos;
      if (parent.type !== 'dir') {
        return fail(ENOTDIR);
      }
      if (!canWrite(parent, identity.name)) {
        return fail(EACCES);
      }
      const existing = parent.children[name];
      if (existing?.type === 'dir') {
        return fail(EISDIR);
      }
      parent.children[name] = file(content, undefined, {
        owner: existing?.owner ?? identity.name,
        group: existing?.group ?? identity.name,
        mode: existing?.mode ?? 0o644,
      });
      return { ok: true };
    },
    mkdir(rel, identity) {
      const pos = parentOf(rel);
      if (!pos) {
        return fail(ENOENT);
      }
      const { parent, name } = pos;
      if (parent.type !== 'dir') {
        return fail(ENOTDIR);
      }
      if (!canWrite(parent, identity.name)) {
        return fail(EACCES);
      }
      if (parent.children[name]) {
        return fail(EEXIST);
      }
      parent.children[name] = dir(
        {},
        { owner: identity.name, group: identity.name }
      );
      return { ok: true };
    },
    rm(rel, { recurse } = {}, identity) {
      const pos = parentOf(rel);
      if (!pos) {
        return fail(ENOENT);
      }
      const { parent, name } = pos;
      if (parent.type !== 'dir') {
        return fail(ENOENT);
      }
      const node = parent.children[name];
      if (!node) {
        return fail(ENOENT);
      }
      if (node.type === 'dir' && !recurse) {
        return fail(EISDIR);
      }
      if (!canWrite(parent, identity.name)) {
        return fail(EACCES);
      }
      delete parent.children[name];
      return { ok: true };
    },
    rebuild() {
      root = buildRoot();
    },
  };
}

export function createVfs(): Vfs {
  const mounts: Mount[] = [];

  const sortMounts = () => {
    mounts.sort((a, b) => b.path.length - a.path.length);
  };

  const registerMount = (mount: Mount) => {
    mounts.push(mount);
    sortMounts();
  };

  const resetVfs = () => {
    for (const m of mounts) {
      m.rebuild?.();
    }
  };

  const normalize = (pathStr: string, cwd: string): string | null => {
    if (!pathStr) {
      return null;
    }
    let p = pathStr;
    if (p === '~') {
      p = HOME;
    } else if (p.startsWith('~/')) {
      p = HOME + p.slice(1);
    }
    if (!p.startsWith('/')) {
      p = (cwd || '/') + '/' + p;
    }
    const parts = p.split('/').filter(Boolean);
    const out: string[] = [];
    for (const part of parts) {
      if (part === '.') {
        continue;
      }
      if (part === '..') {
        out.pop();
        continue;
      }
      out.push(part);
    }
    return '/' + out.join('/');
  };

  const findMount = (abs: string): { mount: Mount; rel: string } | null => {
    for (const m of mounts) {
      if (abs === m.path) {
        return { mount: m, rel: '' };
      }
      if (abs.startsWith(m.path + '/')) {
        return { mount: m, rel: abs.slice(m.path.length + 1) };
      }
    }
    return null;
  };

  const virtualRootNode = (): DirNode => {
    const children: Record<string, VfsNode> = {};
    for (const m of mounts) {
      const segs = m.path.split('/').filter(Boolean);
      const top = segs[0];
      if (!top) {
        continue;
      }
      if (segs.length === 1) {
        const n = m.resolve('');
        if (n) {
          children[top] = n;
        }
      } else if (!children[top]) {
        children[top] = dir({});
      }
    }
    return dir(children);
  };

  const rawResolve = (abs: string): VfsNode | null => {
    if (abs === '/') {
      return virtualRootNode();
    }
    const m = findMount(abs);
    if (!m) {
      return null;
    }
    return m.mount.resolve(m.rel);
  };

  const walkCheck = (abs: string, user: string): VfsFailure | null => {
    if (abs === '/') {
      return null;
    }
    const parts = abs.split('/').filter(Boolean);
    let prefix = '';
    for (let i = 0; i < parts.length - 1; i++) {
      prefix += '/' + parts[i];
      const n = rawResolve(prefix);
      if (!n) {
        return fail(ENOENT, prefix);
      }
      if (n.type !== 'dir') {
        return fail(ENOTDIR, prefix);
      }
      if (!canExec(n, user)) {
        return fail(EACCES, prefix);
      }
    }
    return null;
  };

  const resolve = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike
  ): ResolveResult => {
    const abs = normalize(pathStr, cwd);
    if (abs === null) {
      return fail(ENOENT);
    }
    const user = identity.name;
    const chk = walkCheck(abs, user);
    if (chk) {
      return chk;
    }
    const node = rawResolve(abs);
    if (!node) {
      return fail(ENOENT);
    }
    return { ok: true, abs, node, mount: findMount(abs)?.mount };
  };

  const read = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike
  ): ReadResult => {
    const r = resolve(pathStr, cwd, identity);
    if (!r.ok) {
      return r;
    }
    if (r.node.type === 'dir') {
      return fail(EISDIR);
    }
    if (!canRead(r.node, identity.name)) {
      return fail(EACCES);
    }
    return { ok: true, content: contentOf(r.node) };
  };

  const list = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike
  ): ListResult => {
    const r = resolve(pathStr, cwd, identity);
    if (!r.ok) {
      return r;
    }
    if (r.node.type !== 'dir') {
      return { ok: true, entries: [[pathStr, r.node]] };
    }
    if (!canRead(r.node, identity.name)) {
      return fail(EACCES);
    }
    const entries = Object.entries(r.node.children).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return { ok: true, entries };
  };

  const stat = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike
  ): StatResult => {
    const r = resolve(pathStr, cwd, identity);
    if (!r.ok) {
      return r;
    }
    return {
      ok: true,
      type: r.node.type,
      owner: r.node.owner,
      group: r.node.group,
      mode: r.node.mode,
      node: r.node,
    };
  };

  const write = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike,
    content: string
  ): VfsResult => {
    const abs = normalize(pathStr, cwd);
    if (abs === null) {
      return fail(ENOENT);
    }
    const chk = walkCheck(abs, identity.name);
    if (chk) {
      return chk;
    }
    const m = findMount(abs);
    if (!m) {
      return fail(ENOENT);
    }
    if (!m.mount.write) {
      return fail(ENOSYS);
    }
    return m.mount.write(m.rel, content, identity);
  };

  const mkdir = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike
  ): VfsResult => {
    const abs = normalize(pathStr, cwd);
    if (abs === null) {
      return fail(ENOENT);
    }
    const chk = walkCheck(abs, identity.name);
    if (chk) {
      return chk;
    }
    const m = findMount(abs);
    if (!m) {
      return fail(ENOENT);
    }
    if (!m.mount.mkdir) {
      return fail(ENOSYS);
    }
    return m.mount.mkdir(m.rel, identity);
  };

  const rm = (
    pathStr: string,
    cwd: string,
    identity: IdentityLike,
    opts: RmOpts = {}
  ): VfsResult => {
    const abs = normalize(pathStr, cwd);
    if (abs === null) {
      return fail(ENOENT);
    }
    if (abs === '/') {
      return fail(EROOT);
    }
    const chk = walkCheck(abs, identity.name);
    if (chk) {
      return chk;
    }
    const m = findMount(abs);
    if (!m) {
      return fail(ENOENT);
    }
    if (m.rel === '') {
      return fail(EACCES);
    }
    if (!m.mount.rm) {
      return fail(ENOSYS);
    }
    return m.mount.rm(m.rel, opts, identity);
  };

  const displayPath = (absolute: string): string => {
    if (absolute === HOME) {
      return '~';
    }
    if (absolute.startsWith(HOME + '/')) {
      return '~' + absolute.slice(HOME.length);
    }
    return absolute;
  };

  return {
    registerMount,
    resetVfs,
    resolve,
    read,
    list,
    stat,
    write,
    mkdir,
    rm,
    normalize,
    displayPath,
    listMounts: () => mounts.map(m => m.path),
  };
}
