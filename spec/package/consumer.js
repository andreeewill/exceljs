/* eslint-disable import/no-dynamic-require */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {createRequire} = require('module');
const {Writable} = require('stream');
const {finished} = require('stream/promises');

const consumer = process.argv[2];
const consumerRequire = createRequire(path.join(consumer, 'package.json'));
const excelEntry = consumerRequire.resolve('@andreeewill/exceljs');
const excelRequire = createRequire(excelEntry);
const archiverEntry = excelRequire.resolve('archiver');
const archiverRequire = createRequire(archiverEntry);
const readdirEntry = archiverRequire.resolve('readdir-glob');
const readdirRequire = createRequire(readdirEntry);
const minimatchRequire = createRequire(readdirRequire.resolve('minimatch'));
const {ZipArchive} = archiverRequire(archiverEntry);
const JSZip = excelRequire('jszip');

function packageVersion(entry) {
  let directory = path.dirname(entry);
  for (;;) {
    const filename = path.join(directory, 'package.json');
    if (fs.existsSync(filename)) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (data.name && data.version) return data.version;
    }
    const parent = path.dirname(directory);
    assert.notStrictEqual(parent, directory);
    directory = parent;
  }
}

async function workbookRoundTrip(ExcelJS, destination) {
  const chunks = [];
  const filename = path.join(
    fs.mkdtempSync(path.join(consumer, 'round-trip-')),
    'workbook.xlsx'
  );
  const options = {
    useStyles: true,
    useSharedStrings: true,
    zip: {zlib: {level: 1}},
  };
  if (destination === 'file') {
    options.filename = filename;
  } else if (destination === 'stream') {
    options.stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
  }
  const writer = new ExcelJS.stream.xlsx.WorkbookWriter(options);
  const sheet = writer.addWorksheet('Archive migration');
  const row = sheet.addRow(['repeated', 1.25]);
  row.getCell(2).numFmt = '0.00';
  row.commit();
  sheet.addRow(['repeated', {formula: 'B1*2', result: 2.5}]).commit();
  const image = writer.addImage({
    filename: path.resolve(__dirname, '../integration/data/image.png'),
    extension: 'png',
  });
  sheet.addBackgroundImage(image);
  await writer.commit();

  let buffer;
  if (destination === 'file') {
    buffer = fs.readFileSync(filename);
  } else if (destination === 'stream') {
    buffer = Buffer.concat(chunks);
  } else {
    buffer = writer.stream.read();
  }
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const restored = book.getWorksheet('Archive migration');
  assert.strictEqual(restored.getCell('A1').value, 'repeated');
  assert.strictEqual(restored.getCell('A2').value, 'repeated');
  assert.strictEqual(restored.getCell('B1').numFmt, '0.00');
  assert.deepStrictEqual(restored.getCell('B2').value, {
    formula: 'B1*2',
    result: 2.5,
  });
  assert.strictEqual(
    book.getImage(restored.getBackgroundImageId()).buffer.length > 0,
    true
  );
}

async function globRoundTrip() {
  const directory = path.join(consumer, 'glob-input');
  fs.mkdirSync(directory);
  ['a.txt', 'b.txt', '.hidden.txt', 'skip.csv'].forEach(name => {
    fs.writeFileSync(path.join(directory, name), name);
  });
  const chunks = [];
  const output = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const archive = new ZipArchive();
  archive.on('error', error => output.destroy(error));
  archive.pipe(output);
  const complete = finished(output);
  archive.glob('**/{a,b,.hidden}.txt', {
    cwd: directory,
    dot: true,
    ignore: ['**/b.txt'],
  });
  archive.directory(directory, 'all');
  await archive.finalize();
  await complete;
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  const filenames = Object.keys(zip.files)
    .filter(name => !zip.files[name].dir)
    .sort();
  assert.deepStrictEqual(filenames, [
    '.hidden.txt',
    'a.txt',
    'all/.hidden.txt',
    'all/a.txt',
    'all/b.txt',
    'all/skip.csv',
  ]);
}

async function main() {
  assert.strictEqual(packageVersion(archiverEntry), '8.0.0');
  assert.strictEqual(
    readdirRequire('minimatch/package.json').version,
    '11.0.1'
  );
  assert.strictEqual(
    packageVersion(minimatchRequire.resolve('brace-expansion')),
    '5.0.12'
  );
  assert.ok(archiverEntry.startsWith(path.dirname(excelEntry) + path.sep));
  const entries = [
    excelEntry,
    path.join(path.dirname(excelEntry), 'dist/es5/index.js'),
  ];
  await Promise.all(
    entries.flatMap(entry => {
      const ExcelJS = consumerRequire(entry);
      return ['memory', 'stream', 'file'].map(destination =>
        workbookRoundTrip(ExcelJS, destination)
      );
    })
  );
  await globRoundTrip();
  process.stdout.write(
    'Packed consumer passed: patched dependencies, native/ES5 XLSX, glob and directory.\n'
  );
}

main().catch(error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
