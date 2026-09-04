const path = require('path');

const security = verquire('utils/security');

// Minimal stand-in for a JSZip file object
function entry(name, uncompressedSize, compressedSize, dir = false) {
  return {name, dir, _data: {uncompressedSize, compressedSize}};
}

const MB = 1024 * 1024;

describe('security', () => {
  describe('sanitizeCsvValue', () => {
    // CVE-2026-78209
    it('prefixes values a spreadsheet would evaluate', () => {
      for (const value of [
        '=1+1',
        '+1',
        '-1+1',
        '@SUM(A1)',
        '\tcmd',
        '\rcmd',
        '=cmd|\' /C calc\'!A0',
      ]) {
        expect(security.sanitizeCsvValue(value)).to.equal(`'${value}`);
      }
    });

    it('leaves harmless strings alone', () => {
      for (const value of ['hello', '1+1', 'a=b', '', ' =1+1']) {
        expect(security.sanitizeCsvValue(value)).to.equal(value);
      }
    });

    it('leaves non-strings alone', () => {
      const date = new Date();
      expect(security.sanitizeCsvValue(-1)).to.equal(-1);
      expect(security.sanitizeCsvValue(0)).to.equal(0);
      expect(security.sanitizeCsvValue(null)).to.equal(null);
      expect(security.sanitizeCsvValue(undefined)).to.equal(undefined);
      expect(security.sanitizeCsvValue(date)).to.equal(date);
    });
  });

  describe('resolveMediaPath', () => {
    const base = path.resolve('/tmp/media');

    it('passes the filename through when no base dir is given', () => {
      expect(security.resolveMediaPath('../../etc/passwd')).to.equal('../../etc/passwd');
    });

    it('resolves within the base dir', () => {
      expect(security.resolveMediaPath('logo.png', base)).to.equal(
        path.join(base, 'logo.png')
      );
      expect(security.resolveMediaPath('sub/logo.png', base)).to.equal(
        path.join(base, 'sub', 'logo.png')
      );
    });

    // CVE-2026-78208
    it('rejects traversal out of the base dir', () => {
      for (const filename of [
        '../secret.png',
        '../../etc/passwd',
        'sub/../../etc/passwd',
        '/etc/passwd',
        `${base}-sibling/secret.png`,
      ]) {
        expect(() => security.resolveMediaPath(filename, base)).to.throw(
          /escapes base directory/
        );
      }
    });

    it('rejects non-strings and NUL bytes', () => {
      expect(() => security.resolveMediaPath(undefined, base)).to.throw(
        /Invalid media filename/
      );
      expect(() => security.resolveMediaPath('a\u0000.png', base)).to.throw(
        /Invalid media filename/
      );
      // spaces are legal in filenames
      expect(security.resolveMediaPath('my logo.png', base)).to.equal(
        path.join(base, 'my logo.png')
      );
    });
  });

  describe('checkZipBomb', () => {
    it('accepts a realistic workbook', () => {
      const total = security.checkZipBomb([
        entry('xl/', 0, 0, true),
        entry('xl/worksheets/sheet1.xml', 40 * MB, 2 * MB),
        entry('[Content_Types].xml', 1024, 300),
      ]);
      expect(total).to.equal((40 * MB) + 1024);
    });

    // CVE-2026-78206
    it('rejects an entry with an absurd compression ratio', () => {
      expect(() =>
        security.checkZipBomb([entry('xl/worksheets/sheet1.xml', 4096 * MB, 1024)])
      ).to.throw(/suspicious compression ratio/);
    });

    it('ignores the ratio for small entries', () => {
      expect(() =>
        security.checkZipBomb([entry('xl/worksheets/sheet1.xml', MB, 10)])
      ).to.not.throw();
    });

    it('honours maxEntrySize and maxUncompressedSize', () => {
      const entries = [entry('a.xml', 20 * MB, 4 * MB), entry('b.xml', 20 * MB, 4 * MB)];
      expect(() =>
        security.checkZipBomb(entries, {maxEntrySize: 10 * MB})
      ).to.throw(/exceeds maxEntrySize/);
      expect(() =>
        security.checkZipBomb(entries, {maxUncompressedSize: 30 * MB})
      ).to.throw(/exceed maxUncompressedSize/);
      expect(() =>
        security.checkZipBomb(entries, {maxUncompressedSize: 100 * MB})
      ).to.not.throw();
    });

    it('can disable the ratio check', () => {
      expect(() =>
        security.checkZipBomb([entry('a.xml', 4096 * MB, 1024)], {
          maxCompressionRatio: 0,
        })
      ).to.not.throw();
    });
  });
});
