const _ = verquire('utils/under-dash');
const util = require('util');

describe('under-dash', () => {
  describe('isEqual', () => {
    const values = [
      0,
      1,
      true,
      false,
      'string',
      'foobar',
      'other string',
      [],
      ['array'],
      ['array', 'foobar'],
      ['array2'],
      ['array2', 'foobar'],
      {},
      {object: 1},
      {object: 2},
      {object: 1, foobar: 'quux'},
      {object: 2, foobar: 'quux'},
      null,
      undefined,
      () => {},
      () => {},
      Symbol('foo'),
      Symbol('foo'),
      Symbol('bar'),
    ];

    function showVal(o) {
      return util.inspect(o, {compact: true});
    }

    it('works on simple values', () => {
      for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < values.length; j++) {
          const a = values[i];
          const b = values[j];

          const assertion = `${showVal(a)} ${i === j ? '==' : '!='} ${showVal(
            b
          )}`;
          expect(_.isEqual(a, b)).to.equal(i === j, `expected ${assertion}`);
        }
      }
    });

    it('works on complex arrays', () => {
      for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < values.length; j++) {
          const a = [values[i]];
          const b = [values[j]];

          const assertion = `${showVal(a)} ${i === j ? '==' : '!='} ${showVal(
            b
          )}`;
          expect(_.isEqual(a, b)).to.equal(i === j, `expected ${assertion}`);
        }
      }
    });

    it('works on complex objects', () => {
      for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < values.length; j++) {
          const a = {key: values[i]};
          const b = {key: values[j]};

          const assertion = `${showVal(a)} ${i === j ? '==' : '!='} ${showVal(
            b
          )}`;
          expect(_.isEqual(a, b)).to.equal(i === j, `expected ${assertion}`);
        }
      }
    });
  });

  describe('deepMerge', () => {
    afterEach(() => {
      delete Object.prototype.polluted;
    });

    it('merges nested objects and arrays', () => {
      const target = {a: {b: 1}, list: [1, 2]};
      const result = _.deepMerge(target, {a: {c: 2}, list: [9]}, {d: 3});
      expect(result).to.equal(target);
      expect(result.a).to.deep.equal({b: 1, c: 2});
      expect(result.list).to.deep.equal([9, 2]);
      expect(result.d).to.equal(3);
    });

    it('ignores undefined values', () => {
      expect(_.deepMerge({a: 1}, {a: undefined})).to.deep.equal({a: 1});
    });

    // CVE-2026-78207
    it('does not pollute Object.prototype via __proto__', () => {
      _.deepMerge({}, JSON.parse('{"__proto__": {"polluted": "yes"}}'));
      expect({}.polluted).to.equal(undefined);
    });

    it('does not pollute Object.prototype via nested __proto__', () => {
      _.deepMerge({}, JSON.parse('{"a": {"__proto__": {"polluted": "yes"}}}'));
      expect({}.polluted).to.equal(undefined);
    });

    it('does not pollute Object.prototype via constructor.prototype', () => {
      _.deepMerge(
        {},
        JSON.parse('{"constructor": {"prototype": {"polluted": "yes"}}}')
      );
      expect({}.polluted).to.equal(undefined);
    });
  });
});
