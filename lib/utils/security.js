const path = require('path');

// Characters that spreadsheet applications (Excel, LibreOffice Calc, Google
// Sheets) treat as the start of a formula when opening a CSV file.
// See CVE-2026-78209.
const CSV_INJECTION_PATTERN = /^[=+\-@\t\r]/;

// A zip entry whose uncompressed size dwarfs its compressed size is the
// signature of a decompression bomb. Legitimate xlsx XML rarely exceeds ~50:1.
// See CVE-2026-78206.
const DEFAULT_MAX_COMPRESSION_RATIO = 1000;

// Ratios are meaningless for small entries, so only enforce them once an entry
// is big enough to actually threaten the heap.
const RATIO_CHECK_FLOOR = 10 * 1024 * 1024;

const security = {
  /**
   * Neutralise CSV/formula injection by prefixing a text value that a
   * spreadsheet would otherwise evaluate as a formula.
   * Non-string values (numbers, dates, ...) are returned untouched.
   */
  sanitizeCsvValue(value) {
    if (typeof value === 'string' && CSV_INJECTION_PATTERN.test(value)) {
      return `'${value}`;
    }
    return value;
  },

  /**
   * Resolve a media filename, optionally confining it to a base directory.
   * Without a baseDir the path is returned as-is (legacy behaviour); with one,
   * any path escaping the base - via '..', an absolute path or a symlink-ish
   * prefix trick - is rejected. See CVE-2026-78208.
   */
  resolveMediaPath(filename, baseDir) {
    if (typeof filename !== 'string' || filename.includes('\u0000')) {
      throw new Error('Invalid media filename');
    }
    if (!baseDir) {
      return filename;
    }
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, filename);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Media filename escapes base directory: ${filename}`);
    }
    return resolved;
  },

  /**
   * Reject archives that would decompress to more than the caller allows.
   * `entries` are JSZip file objects. See CVE-2026-78206.
   */
  checkZipBomb(entries, options = {}) {
    const maxRatio =
      options.maxCompressionRatio === undefined
        ? DEFAULT_MAX_COMPRESSION_RATIO
        : options.maxCompressionRatio;
    const {maxUncompressedSize, maxEntrySize} = options;

    let total = 0;
    for (const entry of entries) {
      if (entry.dir) {
        continue;
      }
      const data = entry._data || {};
      const uncompressed = data.uncompressedSize || 0;
      const compressed = data.compressedSize || 0;
      total += uncompressed;

      if (maxEntrySize && uncompressed > maxEntrySize) {
        throw new Error(
          `Zip entry ${entry.name} exceeds maxEntrySize (${uncompressed} > ${maxEntrySize})`
        );
      }
      if (
        maxRatio &&
        compressed > 0 &&
        uncompressed >= RATIO_CHECK_FLOOR &&
        uncompressed / compressed > maxRatio
      ) {
        throw new Error(
          `Zip entry ${entry.name} has a suspicious compression ratio ` +
            `(${Math.round(uncompressed / compressed)}:1 > ${maxRatio}:1)`
        );
      }
    }

    if (maxUncompressedSize && total > maxUncompressedSize) {
      throw new Error(
        `Zip contents exceed maxUncompressedSize (${total} > ${maxUncompressedSize})`
      );
    }
    return total;
  },
};

module.exports = security;
