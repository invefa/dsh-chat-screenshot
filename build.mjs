/**
 * Build `client.js` from the parts listed in `src/client/manifest.json`.
 *
 * Why a bundle at all: the client module system serves one file per package
 * (`exports["./client"]`), and the `require` handed to a bundle factory resolves only registered
 * module ids, never a relative path. The browser half therefore has to be a single file, while the
 * sources stay small and separately readable.
 *
 * How the parts are joined: every part is a normal ESM module that node can import on its own (that
 * is what the checks do), and the build deletes only the `import { ... } from './x.js'` lines and
 * the leading `export ` keyword. All parts then share one function scope, so a part sees its
 * neighbours without an import statement. Consequences worth knowing:
 *
 *   - a top-level name must be unique across the whole bundle; a duplicate is a build error, not a
 *     silent shadow (two parts declaring `render` would otherwise clobber each other)
 *   - a part that forgets its `import` still works inside the bundle and breaks only under node;
 *     the cross-check below reports those so the offline checks stay meaningful
 *   - the `require` used by `shell/runtime.js` is the factory parameter, which is why the bundle
 *     body lives inside `factory: (require) => { ... }`
 *
 * Usage:
 *   node build.mjs            write client.js
 *   node build.mjs --check    fail when client.js is stale (used by checks/)
 *   node build.mjs --watch    rebuild on change while developing
 */
import { readFileSync, readdirSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src', 'client');
const OUT = join(ROOT, 'client.js');
const PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** Registration key: the client module system matches it against the boot graph row (the package name). */
const BUNDLE_ID = PACKAGE.name;

const IMPORT = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)'\s*$/;
const DECLARATION = /^export\s+(?:async\s+function|function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;

/** Every `.js` under `src/client`, as manifest-relative posix paths. */
function sourceFiles(dir = SRC, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(join(dir, entry.name), relative));
    else if (entry.name.endsWith('.js')) found.push(relative);
  }
  return found;
}

/** Read one part, strip imports and the `export` keyword, and report the names it declares. */
function compile(part) {
  const lines = readFileSync(join(SRC, part), 'utf8').split(/\r?\n/);
  const names = [];
  const imported = new Set();
  const body = [];
  let pending = '';
  for (const [index, line] of lines.entries()) {
    const at = `src/client/${part}:${index + 1}`;
    if (pending !== '' || line.startsWith('import ')) {
      pending = `${pending} ${line.trim()}`.trim();
      if (!pending.includes("'")) continue;
      const matched = IMPORT.exec(pending);
      if (matched === null) {
        throw new Error(
          `${at}: imports must read \`import { a, b } from './x.js'\`; default, namespace and ` +
            'renamed imports cannot be joined into one scope',
        );
      }
      for (const one of matched[1].split(',')) if (one.trim() !== '') imported.add(one.trim());
      pending = '';
      continue;
    }
    if (line.startsWith('export ')) {
      const matched = DECLARATION.exec(line);
      if (matched === null) {
        throw new Error(
          `${at}: only \`export function|const|let|var|class name\` is supported; re-exports and ` +
            'export default have no meaning in a joined scope',
        );
      }
      names.push(matched[1]);
      body.push(line.slice('export '.length));
      continue;
    }
    if (/^\s*export[\s{]/.test(line)) throw new Error(`${at}: an export must start at column 0`);
    body.push(line);
  }
  return { code: body.join('\n').trim(), names, imported };
}

/** Identifiers a part mentions, used to notice a missing import (which the bundle would hide). */
function words(source) {
  const out = new Set();
  let token = '';
  let dotted = false;
  const stack = [];
  let i = 0;
  const push = () => {
    if (token !== '' && !dotted && !/^\d/.test(token)) out.add(token);
    token = '';
  };
  while (i < source.length) {
    const ch = source[i];
    const two = source.slice(i, i + 2);
    const inTemplate = stack[stack.length - 1] === 't';
    if (!inTemplate && two === '//') {
      push();
      i = source.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (!inTemplate && two === '/*') {
      push();
      i = source.indexOf('*/', i) + 2;
      continue;
    }
    if (!inTemplate && (ch === '"' || ch === "'")) {
      push();
      i += 1;
      while (i < source.length && source[i] !== ch) i += source[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (ch === '`') {
      push();
      if (inTemplate) stack.pop();
      else stack.push('t');
      i += 1;
      continue;
    }
    if (inTemplate) {
      if (two === '${') {
        stack.push('x');
        i += 2;
        continue;
      }
      i += source[i] === '\\' ? 2 : 1;
      continue;
    }
    if (ch === '}' && stack[stack.length - 1] === 'x') {
      push();
      stack.pop();
      i += 1;
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(ch)) {
      if (token === '') dotted = source[i - 1] === '.';
      token += ch;
      i += 1;
      continue;
    }
    push();
    i += 1;
  }
  push();
  // Object keys and labels are not references; `{ loaded: false }` would otherwise look like a use
  // of a module-level `loaded`. The same rule can hide a real reference in a ternary, which is fine
  // for a warning-level check.
  for (const matched of source.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) out.delete(matched[1]);
  return out;
}

const BANNER = `/**
 * Chat screenshot: the client half of the plugin.
 *
 * GENERATED by \`node build.mjs\` from src/client/. Edit those parts, not this file.
 *
 * Two entries share one pipeline: the composer's camera button captures the whole loaded
 * conversation, and each reply's camera button captures that one question and reply. A capture
 * clones the mounted application surface into a hidden stage, crops it to the transcript, renders
 * the clone through an SVG foreignObject and falls back to a hand painter when that document cannot
 * be decoded, then writes the PNG to the clipboard or downloads it.
 */`;

/** Assemble the whole bundle text. */
function bundle() {
  const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
  const parts = Array.isArray(manifest) ? manifest : manifest.files;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('src/client/manifest.json must list the parts in load order');
  }

  const present = new Set(sourceFiles());
  for (const part of parts) {
    if (!present.has(part)) throw new Error(`manifest lists a missing part: ${part}`);
  }
  for (const file of present) {
    if (!parts.includes(file)) {
      throw new Error(
        `src/client/${file} is not listed in manifest.json, so it would never be bundled`,
      );
    }
  }

  const owner = new Map();
  const compiled = new Map();
  const bodies = [];
  for (const part of parts) {
    const result = compile(part);
    compiled.set(part, result);
    for (const name of result.names) {
      if (owner.has(name)) {
        throw new Error(`top-level name '${name}' is declared by both ${owner.get(name)} and ${part}`);
      }
      owner.set(name, part);
    }
    const indented = result.code
      .split('\n')
      .map((line) => (line === '' ? '' : `    ${line}`))
      .join('\n');
    bodies.push(`    // ===== ${part} ${'='.repeat(Math.max(0, 58 - part.length))}\n\n${indented}`);
  }

  const notes = [];
  for (const [part, result] of compiled) {
    const used = words(readFileSync(join(SRC, part), 'utf8'));
    for (const word of used) {
      const from = owner.get(word);
      if (from === undefined || from === part) continue;
      if (result.names.includes(word) || result.imported.has(word)) continue;
      notes.push(`${part} uses '${word}' from ${from} without importing it (the bundle hides this; node does not)`);
    }
    for (const word of result.imported) {
      if (!used.has(word)) notes.push(`${part} imports '${word}' without using it`);
    }
  }
  for (const note of notes) console.error(`  warning: ${note}`);

  const text = [
    BANNER,
    '',
    'window.__ModuleLoader__.load({',
    `  id: '${BUNDLE_ID}',`,
    '  factory: (require) => {',
    '    var module = { exports: {} }',
    '    var exports = module.exports',
    "    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })",
    '',
    bodies.join('\n\n'),
    '',
    '    exports.apply = apply',
    '    exports.inject = inject',
    '    // Pure helpers, for the offline checks only; cordis reads nothing but apply and inject.',
    '    exports.__pure = __pure',
    '    return module.exports',
    '  },',
    '})',
    '',
  ].join('\n');
  return { text: text.replace(/\r\n/g, '\n'), count: parts.length, notes: notes.length };
}

const argv = new Set(process.argv.slice(2));
const built = bundle();

if (argv.has('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current === built.text) {
    console.log(`client.js matches src/client (${built.count} parts)`);
  } else {
    console.error('client.js is stale: src/client changed without a rebuild. Run `node build.mjs`.');
    process.exitCode = 1;
  }
} else {
  writeFileSync(OUT, built.text, 'utf8');
  console.log(`client.js <- ${built.count} parts, ${built.text.split('\n').length} lines`);
  if (argv.has('--watch')) {
    console.log('watching src/client (Ctrl-C to stop)');
    let timer = 0;
    watch(SRC, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const next = bundle();
          writeFileSync(OUT, next.text, 'utf8');
          console.log(`[${new Date().toLocaleTimeString()}] rebuilt`);
        } catch (error) {
          console.error(String((error && error.message) || error));
        }
      }, 80);
    });
  }
}
