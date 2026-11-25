/**
 * Language checks: both tables carry the same keys and the same placeholders, every key a view asks
 * for exists, and the plugin-manager locale files describe the same plugin in both languages.
 *
 * A missing key never crashes at runtime: the locale service shows the key itself, so the picture
 * quietly reads `state.empty` instead of a sentence. That is why this check exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from '../src/client/shell/i18n.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const problems = [];

function fail(message) {
  problems.push(message);
}

const zh = MESSAGES.zh;
const en = MESSAGES.en;

const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

for (const key of Object.keys(zh)) {
  if (!(key in en)) fail(`en is missing key: ${key}`);
}
for (const key of Object.keys(en)) {
  if (!(key in zh)) fail(`zh is missing key: ${key}`);
}
for (const key of Object.keys(zh)) {
  if (!(key in en)) continue;
  const left = placeholders(zh[key]).join(',');
  const right = placeholders(en[key]).join(',');
  if (left !== right) {
    fail(`placeholder mismatch for ${key}: zh has [${left}], en has [${right}]`);
  }
  if (String(zh[key]).trim() === '') fail(`zh has an empty message: ${key}`);
  if (String(en[key]).trim() === '') fail(`en has an empty message: ${key}`);
}

// Every key a view asks for must exist, and every table entry must be asked for somewhere. Both
// spellings count: the components translate through the hook's `t`, while the parts that run outside
// a component (the settings label, the inserted footer line) call `translate` directly.
const used = new Set();
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.js')) {
      const source = readFileSync(path, 'utf8');
      for (const matched of source.matchAll(/\b(?:t|translate)\(\s*'([\w.]+)'/g)) used.add(matched[1]);
    }
  }
};
walk(join(ROOT, 'src/client'));
for (const key of used) {
  if (!(key in zh)) fail(`a view asks for a key that no table holds: ${key}`);
}
for (const key of Object.keys(zh)) {
  if (!used.has(key)) fail(`table entry never used by a view: ${key}`);
}

// The plugin manager reads `locale/<lang>.json`; both languages must describe the same plugin.
const manager = {};
for (const lang of ['en', 'zh']) {
  try {
    manager[lang] = JSON.parse(readFileSync(join(ROOT, 'locale', `${lang}.json`), 'utf8'));
  } catch (error) {
    fail(`locale/${lang}.json is not valid JSON: ${String((error && error.message) || error)}`);
  }
}
for (const lang of Object.keys(manager)) {
  const meta = manager[lang].meta ?? {};
  if (typeof meta.title !== 'string' || meta.title.trim() === '') {
    fail(`locale/${lang}.json must carry meta.title`);
  }
  if (typeof meta.description !== 'string' || meta.description.trim() === '') {
    fail(`locale/${lang}.json must carry meta.description`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.log(`i18n: ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`i18n: ok (${Object.keys(zh).length} keys, 2 languages)`);
}
