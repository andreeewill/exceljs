const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {createRequire} = require('module');

function manifest(entry) {
  let directory = path.dirname(entry);
  for (;;) {
    const filename = path.join(directory, 'package.json');
    if (fs.existsSync(filename)) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (data.name && data.version) return {filename, data};
    }
    const parent = path.dirname(directory);
    assert.notStrictEqual(parent, directory, `Cannot find package manifest for ${entry}`);
    directory = parent;
  }
}

const archiverEntry = require.resolve('archiver');
const archiverRequire = createRequire(archiverEntry);
const readdirEntry = archiverRequire.resolve('readdir-glob');
const readdirRequire = createRequire(readdirEntry);
const minimatchEntry = readdirRequire.resolve('minimatch');
const minimatchRequire = createRequire(minimatchEntry);
const readdir = manifest(readdirEntry);

assert.strictEqual(manifest(archiverEntry).data.version, '8.0.0');
assert.strictEqual(readdir.data.version, '3.0.0');
assert.strictEqual(manifest(minimatchEntry).data.version, '11.0.1');
assert.strictEqual(manifest(minimatchRequire.resolve('brace-expansion')).data.version, '5.0.12');
assert.ok(['^10.2.2', '11.0.1'].includes(readdir.data.dependencies.minimatch));

// Bundled dependencies must declare the patched range because consumer overrides do not apply here.
readdir.data.dependencies.minimatch = '11.0.1';
fs.writeFileSync(readdir.filename, `${JSON.stringify(readdir.data, null, 2)}\n`);

// npm's hidden lock caches dependency manifests even when their contents change.
const cachedTree = path.resolve(__dirname, '../node_modules/.package-lock.json');
if (fs.existsSync(cachedTree)) fs.unlinkSync(cachedTree);
