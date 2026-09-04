const fs = require('fs');
const path = require('path');

const ExcelJS = verquire('exceljs');

const OUT_DIR = './spec/out';
const IMAGE = './spec/integration/data/image.png';

describe('security', () => {
  describe('CSV injection (CVE-2026-78209)', () => {
    function bookWith(values) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('sheet1');
      ws.addRow(values);
      return wb;
    }

    it('neutralises formulas by default', async () => {
      const wb = bookWith(['=1+1', '-cmd', '@SUM(A1)', 'plain', 5, -7]);
      const csv = (await wb.csv.writeBuffer()).toString();
      expect(csv.trim()).to.equal('\'=1+1,\'-cmd,\'@SUM(A1),plain,5,-7');
    });

    it('can be opted out of', async () => {
      const wb = bookWith(['=1+1', 'plain']);
      const csv = (await wb.csv.writeBuffer({sanitizeFormulas: false})).toString();
      expect(csv.trim()).to.equal('=1+1,plain');
    });

    it('leaves formula results alone', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('sheet1');
      ws.getCell('A1').value = {formula: 'A2+A3', result: 7};
      const csv = (await wb.csv.writeBuffer()).toString();
      expect(csv.trim()).to.equal('7');
    });
  });

  describe('media path traversal (CVE-2026-78208)', () => {
    it('allows any path when mediaBaseDir is unset', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addImage({filename: IMAGE, extension: 'png'});
      await wb.xlsx.writeBuffer();
    });

    it('allows paths inside mediaBaseDir', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addImage({filename: 'image.png', extension: 'png'});
      await wb.xlsx.writeBuffer({
        mediaBaseDir: path.dirname(IMAGE),
      });
    });

    it('rejects paths escaping mediaBaseDir', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addImage({filename: '../../../etc/passwd', extension: 'png'});
      let error = null;
      try {
        await wb.xlsx.writeBuffer({mediaBaseDir: path.dirname(IMAGE)});
      } catch (e) {
        error = e;
      }
      expect(error).to.not.equal(null);
      expect(error.message).to.match(/escapes base directory/);
    });

    it('rejects paths escaping mediaBaseDir in the streaming writer', async () => {
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: `${OUT_DIR}/security-stream.xlsx`,
        mediaBaseDir: path.dirname(IMAGE),
      });
      wb.addImage({filename: '../../../etc/passwd', extension: 'png'});
      const ws = wb.addWorksheet('sheet1');
      ws.addRow([1]).commit();
      ws.commit();
      let error = null;
      try {
        await wb.commit();
      } catch (e) {
        error = e;
      }
      expect(error).to.not.equal(null);
      expect(error.message).to.match(/escapes base directory/);
    });
  });

  describe('zip bomb (CVE-2026-78206)', () => {
    async function bomb() {
      // one entry that inflates ~250,000:1
      const JSZip = require('jszip');
      const zip = new JSZip();
      zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(64 * 1024 * 1024, 0x20));
      return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {level: 9},
      });
    }

    it('rejects a decompression bomb', async () => {
      const buffer = await bomb();
      const wb = new ExcelJS.Workbook();
      let error = null;
      try {
        await wb.xlsx.load(buffer);
      } catch (e) {
        error = e;
      }
      expect(error).to.not.equal(null);
      expect(error.message).to.match(/suspicious compression ratio/);
    });

    it('still loads a normal workbook', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('sheet1');
      ws.addRow(['a', 'b', 'c']);
      const buffer = await wb.xlsx.writeBuffer();

      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(buffer);
      expect(wb2.getWorksheet('sheet1').getRow(1).values).to.deep.equal([
        undefined,
        'a',
        'b',
        'c',
      ]);
    });

    it('honours maxUncompressedSize', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('sheet1').addRow(['a']);
      const buffer = await wb.xlsx.writeBuffer();

      const wb2 = new ExcelJS.Workbook();
      let error = null;
      try {
        await wb2.xlsx.load(buffer, {maxUncompressedSize: 10});
      } catch (e) {
        error = e;
      }
      expect(error).to.not.equal(null);
      expect(error.message).to.match(/exceed maxUncompressedSize/);
    });
  });

  before(() => {
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, {recursive: true});
    }
  });
});
