# Changelog

Changes to `@andreeewill/exceljs` are documented here. This changelog covers
the security-patched fork; upstream ExcelJS history remains in the README.

## 6.0.0 - 2026-11-05

### Breaking changes

- Require Node.js **22.13.0 or newer**, including when using the ES5 entry
  point. The library loads Archiver's ESM exports from CommonJS while preserving
  synchronous `new WorkbookWriter()` construction.
- Drop support for older Node.js versions. Upgrade the runtime in development,
  CI, and production before installing this release.

### Security

- Upgrade Archiver from 7.0.1 to 8.0.0 and migrate the streaming XLSX writer to
  its `ZipArchive` API.
- Use minimatch 11.0.1 and brace-expansion 5.0.12 in Archiver's dependency tree
  to address these advisories:
  - [minimatch resource amplification (SNYK-JS-MINIMATCH-22111072)](https://security.snyk.io/vuln/SNYK-JS-MINIMATCH-22111072).
  - [brace-expansion ReDoS (SNYK-JS-BRACEEXPANSION-20244950)](https://security.snyk.io/vuln/SNYK-JS-BRACEEXPANSION-20244950).
  - [brace-expansion uncontrolled recursion (SNYK-JS-BRACEEXPANSION-20244948)](https://security.snyk.io/vuln/SNYK-JS-BRACEEXPANSION-20244948).
  - [brace-expansion uncontrolled recursion (SNYK-JS-BRACEEXPANSION-20244952)](https://security.snyk.io/vuln/SNYK-JS-BRACEEXPANSION-20244952).
- Bundle the patched Archiver dependency tree in the npm package so consumers
  receive the fixes without configuring npm overrides. During packaging, verify
  the tested versions and update the bundled `readdir-glob` dependency manifest
  to declare minimatch 11.0.1.

### Added

- Packaged-consumer regression checks for dependency resolution, native and
  ES5 streaming XLSX exports, shared strings, styles, images, formulas, and
  Archiver's glob and directory operations.

### Changed

- Test supported Node.js versions in CI, including the minimum version 22.13.0.
- Use lockfile-based dependency installation in CI and test the packed library
  in a fresh consumer project.

### Upgrading from 5.x

1. Upgrade Node.js to 22.13.0 or newer.
2. After 6.0.0 is published, install it:

   ```sh
   npm install @andreeewill/exceljs@^6.0.0
   ```

The public workbook API is preserved. Existing CommonJS imports and synchronous
`new ExcelJS.stream.xlsx.WorkbookWriter(options)` calls continue to work.
