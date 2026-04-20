import type { PluginInstall } from '../core/kernel.js';
import type {
  DirNode,
  FileContent,
  FileNode,
  IdentityLike,
  Mount,
  VfsNode,
  VfsResult,
} from '../core/vfs.js';
import { dir, file } from '../core/vfs.js';

const CHAR_SPECIAL = 'character special';
const BLOCK_SPECIAL = 'block special';
const ZERO_CHUNK = 256;

const hexDump = (): string => {
  const lines: string[] = [];
  for (let row = 0; row < 4; row++) {
    const bytes: string[] = [];
    for (let i = 0; i < 16; i++) {
      bytes.push(
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
      );
    }
    lines.push(bytes.slice(0, 8).join(' ') + '  ' + bytes.slice(8).join(' '));
  }
  return lines.join('\n');
};

const zeros = (): string => '\0'.repeat(ZERO_CHUNK);

type DevSpec = {
  content: FileContent;
  fileType: string;
  mode: number;
  /** discard accepts writes silently, full rejects with ENOSPC, readonly with EACCES. */
  writePolicy: 'discard' | 'full' | 'readonly';
};

const SPEC: Record<string, DevSpec> = {
  null: {
    content: '',
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'discard',
  },
  zero: {
    content: zeros,
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'discard',
  },
  random: {
    content: hexDump,
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'discard',
  },
  urandom: {
    content: hexDump,
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'discard',
  },
  full: {
    content: zeros,
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'full',
  },
  tty: {
    content: '/dev/pts/0\n',
    fileType: CHAR_SPECIAL,
    mode: 0o666,
    writePolicy: 'discard',
  },
  console: {
    content: '',
    fileType: CHAR_SPECIAL,
    mode: 0o600,
    writePolicy: 'readonly',
  },
  nvme0n1: {
    content: '',
    fileType: BLOCK_SPECIAL,
    mode: 0o660,
    writePolicy: 'readonly',
  },
  nvme0n1p1: {
    content: '',
    fileType: BLOCK_SPECIAL,
    mode: 0o660,
    writePolicy: 'readonly',
  },
  nvme0n1p2: {
    content: '',
    fileType: BLOCK_SPECIAL,
    mode: 0o660,
    writePolicy: 'readonly',
  },
};

const specToNode = (spec: DevSpec): FileNode =>
  file(spec.content, spec.fileType, { mode: spec.mode });

const buildDev = (): DirNode =>
  dir({
    ...Object.fromEntries(
      Object.entries(SPEC).map(([name, spec]) => [name, specToNode(spec)])
    ),
    pts: dir({
      '0': file('', CHAR_SPECIAL, { mode: 0o620 }),
    }),
    fd: dir({
      '0': file('', CHAR_SPECIAL, { mode: 0o620 }),
      '1': file('', CHAR_SPECIAL, { mode: 0o620 }),
      '2': file('', CHAR_SPECIAL, { mode: 0o620 }),
    }),
  });

const install: PluginInstall = kernel => {
  let root = buildDev();

  const resolveNode = (rel: string): VfsNode | null => {
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

  const writeTo = (
    rel: string,
    _content: string,
    _identity: IdentityLike
  ): VfsResult => {
    const name = rel.split('/').filter(Boolean).join('/');
    const spec = SPEC[name];
    if (!spec) {
      return { ok: false, error: 'ENOENT' };
    }
    if (spec.writePolicy === 'full') {
      return { ok: false, error: 'ENOSPC' };
    }
    if (spec.writePolicy === 'readonly') {
      return { ok: false, error: 'EACCES' };
    }
    return { ok: true };
  };

  const mount: Mount = {
    path: '/dev',
    resolve: resolveNode,
    write: writeTo,
    rebuild() {
      root = buildDev();
    },
  };

  kernel.registerMount(mount);
};

export default install;
