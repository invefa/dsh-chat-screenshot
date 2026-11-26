/**
 * Shape checks: the package still looks like a DSH client plugin, its parts are all bundled, and
 * the built bundle is current, parseable and registered under the package's own name.
 *
 * These are the failures that cost an hour to find by hand: a manifest entry that no longer exists,
 * a `dsh.client` block that drifted from the exports map, and a bundle whose registration id does
 * not match the boot graph row (the page then loads it and reports "loaded without registering").
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const problems = [];

function fail(message) {
  problems.push(message);
}

function readJson(relative) {
  try {
    return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));
  } catch (error) {
    fail(`${relative} is not valid JSON: ${String((error && error.message) || error)}`);
    return null;
  }
}

const required = [
  'index.js',
  'client.js',
  'package.json',
  'cordis.patch.yml',
  'build.mjs',
  'icon.svg',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'AGENTS.md',
  'AGENTS.zh-CN.md',
  'locale/en.json',
  'locale/zh.json',
  'src/client/manifest.json',
  'src/client/apply.js',
  'checks/structure.mjs',
  'checks/i18n.mjs',
  'checks/logic.mjs',
];
for (const file of required) {
  if (!existsSync(join(ROOT, file))) fail(`missing file: ${file}`);
}

const pkg = readJson('package.json');
if (pkg !== null) {
  if (pkg.author !== 'invefa') fail('package.json author must be invefa');
  if (pkg.main !== 'index.js') fail('package.json main must be index.js');
  if ((pkg.exports || {})['./client'] !== './client.js') {
    fail('package.json exports["./client"] must be ./client.js');
  }
  if (((pkg.dsh || {}).client || {}).platform !== 'web') {
    fail('package.json dsh.client.platform must be "web"');
  }
  const patch = ((pkg.dsh || {}).bundle || {}).patch;
  if (typeof patch !== 'string') fail('package.json dsh.bundle.patch must name the loader patch');
  else if (!existsSync(join(ROOT, patch))) fail(`dsh.bundle.patch names a missing file: ${patch}`);
  if (!Array.isArray(((pkg.dsh || {}).client || {}).inject)) {
    fail('package.json dsh.client.inject must list the client packages this plugin builds on');
  }
}

// The manifest is the bundle order; every part on disk must appear in it and nothing else.
const manifestPath = join(ROOT, 'src/client/manifest.json');
if (existsSync(manifestPath)) {
  const manifest = readJson('src/client/manifest.json');
  const parts = Array.isArray(manifest) ? manifest : [];
  if (parts.length === 0) fail('src/client/manifest.json must list the parts in load order');
  for (const part of parts) {
    if (!existsSync(join(ROOT, 'src/client', part))) fail(`manifest lists a missing part: ${part}`);
  }
  const walk = (dir, prefix) => {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), relative));
      else if (entry.name.endsWith('.js')) found.push(relative);
    }
    return found;
  };
  for (const file of walk(join(ROOT, 'src/client'), '')) {
    if (!parts.includes(file)) {
      fail(`src/client/${file} is not in the manifest, so the bundle would not contain it`);
    }
  }
}

// The bundle patch is what puts the entry into a profile, and the loader dialect is picky:
// `insert:` appends a row, while a mapping without it only patches an existing row by id and is
// skipped with a warning otherwise. Getting this wrong means the plugin simply never loads.
const patchPath = join(ROOT, 'cordis.patch.yml');
if (existsSync(patchPath) && pkg !== null) {
  const patch = readFileSync(patchPath, 'utf8');
  if (!/^\s*-\s*insert:\s*$/m.test(patch)) {
    fail('cordis.patch.yml must open with a `- insert:` row; the loader ignores anything else');
  }
  if (!patch.includes(`name: ${pkg.name}`)) {
    fail(`cordis.patch.yml must insert the package by name: ${pkg.name}`);
  }
}

// The bundle: parseable, registered under the package name, and exporting what cordis reads.
if (existsSync(join(ROOT, 'client.js')) && pkg !== null) {
  const source = readFileSync(join(ROOT, 'client.js'), 'utf8');
  try {
    // Parsing only: the factory body is not executed here, so `window` never has to exist.
    new Function(source);
  } catch (error) {
    fail(`client.js does not parse: ${String((error && error.message) || error)}`);
  }
  if (!source.includes('window.__ModuleLoader__.load(')) {
    fail('client.js must register through window.__ModuleLoader__.load');
  }
  if (!source.includes(`id: '${pkg.name}'`)) {
    fail(`client.js must register with the package name '${pkg.name}'`);
  }
  if (!source.includes('exports.apply = apply')) fail('client.js must export apply');
  if (!source.includes('exports.inject = inject')) fail('client.js must export inject');
}

if (problems.length > 0) {
  for (const problem of problems) console.log(`structure: ${problem}`);
  process.exitCode = 1;
} else {
  console.log('structure: ok');
}
