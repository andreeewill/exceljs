/* eslint-disable no-bitwise */
// Minimal RFC 4122 v4 generator.
//
// This replaces the `uuid` package: exceljs only ever needed v4, and the
// dependency dragged in an advisory (GHSA-w5hq-g745-h8pq) plus a browser build
// that this project's bundler cannot parse. WebCrypto is used where available -
// note this deliberately avoids `require('crypto')`, which would pull the whole
// crypto-browserify shim into the browser bundle. The generated value is an
// x14Id (a document-local identifier), not a secret, so the Math.random
// fallback on runtimes without WebCrypto is adequate.

/* eslint-disable no-undef, no-restricted-globals */
const globalObject =
  (typeof self !== 'undefined' && self) ||
  (typeof window !== 'undefined' && window) ||
  (typeof global !== 'undefined' && global) ||
  {};
/* eslint-enable no-undef, no-restricted-globals */

const webCrypto = globalObject.crypto;

const HEX = [];
for (let i = 0; i < 256; i++) {
  HEX.push((i + 0x100).toString(16).substr(1));
}

function randomBytes() {
  const bytes = new Uint8Array(16);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

function hex(bytes, from, to) {
  let result = '';
  for (let i = from; i < to; i++) {
    result += HEX[bytes[i]];
  }
  return result;
}

function v4() {
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const b = randomBytes();
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10

  return `${hex(b, 0, 4)}-${hex(b, 4, 6)}-${hex(b, 6, 8)}-${hex(b, 8, 10)}-${hex(b, 10, 16)}`;
}

module.exports = {v4};
