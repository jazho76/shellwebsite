import { parseAnsi, styleFor } from './ansi.js';
import type { Kernel } from './kernel.js';

const MARKUP_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export type EntryHandle = {
  append(nodeOrStr: string | Node): void;
  detach(): void;
};

export type Terminal = {
  emit(nodeOrStr: string | Node): void;
  emitLine(text: string, className?: string | null): HTMLElement;
  setLineContent(line: HTMLElement, text: string): void;
  spacer(): void;
  appendEntry(
    commandText: string,
    outputContent: string | Node | null
  ): HTMLElement;
  beginEntry(commandText: string): EntryHandle;
  clear(): void;
  setPromptVisible(visible: boolean): void;
  lockSession(): void;
  toggleClass(cls: string, on?: boolean): void;
  corrupt(intensity: number): void;
  fakeType(text: string, delay: number): Promise<void>;
  seedHistory(lines: string[]): void;
  getHistory(): string[];
  pushHistory(line: string): void;
  updatePrompt(): void;
  focusInput(): void;
  setBusy(value: boolean): void;
};

export function createTerminal(kernel: Kernel): Terminal {
  const output = document.getElementById('output') as HTMLElement;
  const inputLine = document.getElementById('input-line') as HTMLElement;
  const input = document.getElementById('input') as HTMLInputElement;
  const typed = document.getElementById('typed') as HTMLElement;
  const typedAfter = document.getElementById('typed-after') as HTMLElement;
  const cursor = inputLine.querySelector('.cursor') as HTMLElement;

  const history: string[] = [];
  let historyIndex = -1;
  let lastTabState: { value: string; caret: number } | null = null;
  let promptVisible = false;
  let busy = false;
  let locked = false;

  const el = (
    tag: string,
    className?: string | null,
    text?: string
  ): HTMLElement => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  };

  const linkNode = (href: string, label: string): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (/^https?:/i.test(href)) {
      a.target = '_blank';
    }
    return a;
  };

  const renderMarkupInto = (str: string, parent: Node): void => {
    let last = 0;
    MARKUP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MARKUP_RE.exec(str)) !== null) {
      if (m.index > last) {
        parent.appendChild(document.createTextNode(str.slice(last, m.index)));
      }
      parent.appendChild(linkNode(m[2] as string, m[1] as string));
      last = m.index + m[0].length;
    }
    if (last < str.length) {
      parent.appendChild(document.createTextNode(str.slice(last)));
    }
  };

  const renderMarkup = (str: string): DocumentFragment => {
    const frag = document.createDocumentFragment();
    for (const seg of parseAnsi(str)) {
      const style = styleFor(seg.attrs);
      if (style) {
        const span = document.createElement('span');
        if (style.classes.length) {
          span.className = style.classes.join(' ');
        }
        if (style.style) {
          span.setAttribute('style', style.style);
        }
        renderMarkupInto(seg.text, span);
        frag.appendChild(span);
      } else {
        renderMarkupInto(seg.text, frag);
      }
    }
    return frag;
  };

  const scrollToBottom = () => {
    window.scrollTo(0, document.body.scrollHeight);
  };

  const emit: Terminal['emit'] = nodeOrStr => {
    if (typeof nodeOrStr === 'string') {
      output.append(renderMarkup(nodeOrStr));
    } else {
      output.append(nodeOrStr);
    }
    scrollToBottom();
  };

  const emitLine: Terminal['emitLine'] = (text, className) => {
    const line = el('div', className ?? null);
    if (text === '') {
      line.textContent = '\u00a0';
    } else {
      line.append(renderMarkup(text));
    }
    output.append(line);
    scrollToBottom();
    return line;
  };

  const setLineContent: Terminal['setLineContent'] = (line, text) => {
    if (text === '') {
      line.replaceChildren(document.createTextNode('\u00a0'));
    } else {
      line.replaceChildren(renderMarkup(text));
    }
  };

  const spacer = () => {
    output.append(el('div', 'spacer'));
    scrollToBottom();
  };

  const promptNode = (): HTMLElement => {
    const id = kernel.identity.current();
    const wrap = el('div', 'prompt');
    const hostEl = el('div', 'host', `${id.name}@${id.hostname}`);
    wrap.append(
      hostEl,
      el('div', 'colon', ':'),
      el('div', 'cwd', kernel.vfs.displayPath(kernel.getCwd())),
      el('div', 'priv', id.name === 'root' ? '#' : '$')
    );
    return wrap;
  };

  const appendEntry: Terminal['appendEntry'] = (commandText, outputContent) => {
    const entry = el('div', 'entry');
    const line = el('div', 'line');
    line.append(promptNode(), el('span', 'typed', ' ' + commandText));
    entry.append(line);
    if (
      outputContent !== null &&
      outputContent !== undefined &&
      outputContent !== ''
    ) {
      const out = el('div', 'out');
      if (typeof outputContent === 'string') {
        out.append(renderMarkup(outputContent));
      } else {
        out.append(outputContent);
      }
      entry.append(out);
    }
    output.append(entry);
    scrollToBottom();
    return entry;
  };

  const beginEntry: Terminal['beginEntry'] = commandText => {
    const entry = el('div', 'entry');
    const line = el('div', 'line');
    line.append(promptNode(), el('span', 'typed', ' ' + commandText));
    entry.append(line);
    const outDiv = el('div', 'out');
    entry.append(outDiv);
    output.append(entry);
    scrollToBottom();
    let detached = false;
    return {
      append(nodeOrStr) {
        if (detached) {
          return;
        }
        if (typeof nodeOrStr === 'string') {
          outDiv.append(renderMarkup(nodeOrStr));
        } else {
          outDiv.append(nodeOrStr);
        }
        scrollToBottom();
      },
      detach() {
        detached = true;
      },
    };
  };

  const clear = () => {
    output.replaceChildren();
  };

  const setPromptVisible: Terminal['setPromptVisible'] = visible => {
    if (locked) {
      return;
    }
    promptVisible = visible;
    inputLine.classList.toggle('hidden', !visible);
    if (visible && !busy) {
      focusInput();
    }
  };
  const setBusy: Terminal['setBusy'] = value => {
    if (locked) {
      return;
    }
    busy = value;
  };
  const lockSession: Terminal['lockSession'] = () => {
    locked = true;
    promptVisible = false;
    busy = true;
    inputLine.classList.toggle('hidden', true);
  };

  const focusInput = () => {
    input.focus();
  };

  const toggleClass: Terminal['toggleClass'] = (cls, on) => {
    if (on === undefined) {
      document.body.classList.toggle(cls);
    } else {
      document.body.classList.toggle(cls, on);
    }
  };

  const updatePrompt = () => {
    const id = kernel.identity.current();
    const hostEl = inputLine.querySelector('.host') as HTMLElement | null;
    const privEl = inputLine.querySelector('.priv') as HTMLElement | null;
    const cwdEl = inputLine.querySelector('.cwd') as HTMLElement | null;
    if (hostEl) {
      hostEl.textContent = `${id.name}@${id.hostname}`;
    }
    if (privEl) {
      privEl.textContent = id.name === 'root' ? '#' : '$';
    }
    if (cwdEl) {
      cwdEl.textContent = kernel.vfs.displayPath(kernel.getCwd());
    }
  };

  const seedHistory: Terminal['seedHistory'] = lines => {
    history.length = 0;
    for (const line of lines) {
      if (line) {
        history.push(line);
      }
    }
    historyIndex = history.length;
  };
  const getHistory: Terminal['getHistory'] = () => history.slice();
  const pushHistory: Terminal['pushHistory'] = line => {
    history.push(line);
    historyIndex = history.length;
  };

  const renderTyped = () => {
    const value = input.value;
    const pos = input.selectionStart ?? value.length;
    typed.textContent = value.slice(0, pos);
    cursor.textContent = value.slice(pos, pos + 1);
    typedAfter.textContent = value.slice(pos + 1);
  };
  const setTyped = (value: string) => {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    renderTyped();
  };
  const pushTyped = (ch: string) => {
    typed.textContent += ch;
    scrollToBottom();
  };
  const fakeType: Terminal['fakeType'] = async (text, delay) => {
    setPromptVisible(true);
    for (const ch of text) {
      pushTyped(ch);
      await new Promise(r => setTimeout(r, delay));
    }
    await new Promise(r => setTimeout(r, 200));
    setTyped('');
    await kernel.shell.run(text);
  };
  const setInputValue = (value: string, caret: number) => {
    input.value = value;
    input.setSelectionRange(caret, caret);
    renderTyped();
  };

  const corrupt: Terminal['corrupt'] = intensity => {
    const blockChars = '\u2588\u2591\u2592\u2593';
    const noiseChars =
      '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789abcdef' +
      '\u2580\u2584\u258C\u2590\u00A7\u00B6\u00BF\u00D7\u03A3\u03A9\u0416\u042F\u30C4\u4E71\uFFFD';
    const pickChar = () => {
      const pool = Math.random() < intensity * 0.8 ? blockChars : noiseChars;
      return pool[Math.floor(Math.random() * pool.length)] as string;
    };
    const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    for (const tn of textNodes) {
      const src = tn.data;
      if (!src.trim()) {
        continue;
      }
      let result = '';
      for (let i = 0; i < src.length; i++) {
        result += Math.random() < intensity ? pickChar() : src[i];
      }
      tn.data = result;
    }
  };

  const commonPrefix = (strs: string[]): string => {
    if (strs.length === 0) {
      return '';
    }
    let p = strs[0] as string;
    for (let i = 1; i < strs.length; i++) {
      while (!(strs[i] as string).startsWith(p)) {
        p = p.slice(0, -1);
      }
      if (!p) {
        break;
      }
    }
    return p;
  };

  const tabComplete = () => {
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const tokenMatch = before.match(/\S*$/);
    const token = tokenMatch ? tokenMatch[0] : '';
    const prefix = before.slice(0, before.length - token.length);
    const isFirstWord = prefix.trim() === '';

    let candidates: string[] = [];
    let stem: string;
    let suffixFor: (name: string) => string = () => ' ';

    if (isFirstWord && !token.includes('/')) {
      stem = token;
      const names = new Set<string>();
      for (const dir of kernel.getPath()) {
        const prefixLen = (dir.endsWith('/') ? dir : dir + '/').length;
        for (const e of kernel.listExecutablesOn(dir)) {
          const base = e.absPath.slice(prefixLen);
          if (base.startsWith(stem)) {
            names.add(base);
          }
        }
      }
      candidates = [...names].sort();
    } else {
      const slash = token.lastIndexOf('/');
      const dirPart = slash === -1 ? '' : token.slice(0, slash + 1);
      stem = slash === -1 ? token : token.slice(slash + 1);
      const identity = kernel.identity.current();
      const listResult = kernel.vfs.list(
        dirPart || '.',
        kernel.getCwd(),
        identity
      );
      if (!listResult.ok) {
        lastTabState = { value, caret };
        return;
      }
      const showHidden = stem.startsWith('.');
      const entries = listResult.entries.filter(([name]) => {
        if (!name.startsWith(stem)) {
          return false;
        }
        if (!showHidden && name.startsWith('.')) {
          return false;
        }
        return true;
      });
      candidates = entries.map(([name]) => name);
      const typeByName = Object.fromEntries(
        entries.map(([n, node]) => [n, node.type])
      );
      suffixFor = name => (typeByName[name] === 'dir' ? '/' : ' ');
    }

    if (candidates.length === 0) {
      lastTabState = { value, caret };
      return;
    }

    if (candidates.length === 1) {
      const match = candidates[0] as string;
      const completion = match.slice(stem.length) + suffixFor(match);
      const newBefore = before + completion;
      setInputValue(newBefore + after, newBefore.length);
      lastTabState = null;
      return;
    }

    const cp = commonPrefix(candidates);
    if (cp.length > stem.length) {
      const completion = cp.slice(stem.length);
      const newBefore = before + completion;
      setInputValue(newBefore + after, newBefore.length);
      lastTabState = { value: input.value, caret: newBefore.length };
      return;
    }

    const isRepeat =
      lastTabState !== null &&
      lastTabState.value === value &&
      lastTabState.caret === caret;
    if (isRepeat) {
      const display = candidates
        .map(n => n + (suffixFor(n) === '/' ? '/' : ''))
        .join('  ');
      appendEntry(value, display);
      lastTabState = null;
    } else {
      lastTabState = { value, caret };
    }
  };

  input.addEventListener('input', renderTyped);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) {
      renderTyped();
    }
  });
  document.addEventListener('click', e => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'A') {
      return;
    }
    if (!promptVisible || busy) {
      return;
    }
    focusInput();
  });

  input.addEventListener('keydown', e => {
    if (!promptVisible || busy) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      tabComplete();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      setTyped('');
      kernel.shell.execute(value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) {
        return;
      }
      historyIndex = Math.max(0, historyIndex - 1);
      setTyped(history[historyIndex] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0) {
        return;
      }
      historyIndex = Math.min(history.length, historyIndex + 1);
      setTyped(history[historyIndex] ?? '');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clear();
    }
  });

  document.addEventListener('keydown', e => {
    kernel.emit('keydown', e);
  });

  kernel.on('reboot', () => {
    locked = false;
    busy = false;
    clear();
    setPromptVisible(false);
  });

  return {
    emit,
    emitLine,
    setLineContent,
    spacer,
    appendEntry,
    beginEntry,
    clear,
    setPromptVisible,
    lockSession,
    toggleClass,
    corrupt,
    fakeType,
    seedHistory,
    getHistory,
    pushHistory,
    updatePrompt,
    focusInput,
    setBusy,
  };
}
