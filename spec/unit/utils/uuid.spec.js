const {v4} = verquire('utils/uuid');

const V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  it('generates well-formed v4 uuids', () => {
    for (let i = 0; i < 1000; i++) {
      expect(v4()).to.match(V4_PATTERN);
    }
  });

  it('generates distinct values', () => {
    const seen = new Set();
    for (let i = 0; i < 10000; i++) {
      seen.add(v4());
    }
    expect(seen.size).to.equal(10000);
  });
});
