const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'exceljs-package-'));
const consumer = path.join(temporary, 'consumer');
const metadata = require('../package.json');

function npm(args, cwd) {
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {cwd, stdio: 'inherit'});
}

try {
  npm(['pack', '--pack-destination', temporary, '--quiet'], root);
  const filename = `${metadata.name.replace('@', '').replace('/', '-')}-${metadata.version}.tgz`;
  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'exceljs-package-consumer',
      version: '1.0.0',
      private: true,
      dependencies: {[metadata.name]: `file:${path.join(temporary, filename)}`},
    })
  );
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], consumer);
  npm(['ls', '--omit=dev', '--all'], consumer);
  execFileSync(process.execPath, [path.join(root, 'spec/package/consumer.js'), consumer], {
    cwd: consumer,
    stdio: 'inherit',
  });
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
