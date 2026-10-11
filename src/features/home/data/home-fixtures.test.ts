/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeData } from '../testing/home-test-data.ts';
import { applyHomeFixture, HOME_FIXTURES, resolveHomeFixture } from './home-fixtures.ts';

describe('resolveHomeFixture', () => {
  it('lists exactly the supported fixtures', () => {
    assert.deepEqual(
      [...HOME_FIXTURES].sort(),
      ['all-empty', 'broken-image', 'empty-section', 'one-banner', 'server-fail', 'zero-banners'],
    );
  });

  it('returns the fixture in development', () => {
    for (const name of HOME_FIXTURES) {
      assert.equal(resolveHomeFixture({ isDev: true, raw: name }), name);
    }
  });

  it('ignores every fixture outside development', () => {
    for (const name of HOME_FIXTURES) {
      assert.equal(resolveHomeFixture({ isDev: false, raw: name }), undefined);
    }
  });

  it('ignores unknown, empty, padded or differently cased values', () => {
    for (const raw of [undefined, '', ' ', 'nope', 'ALL-EMPTY', ' all-empty', 'all-empty ', 'all-empty,one-banner']) {
      assert.equal(resolveHomeFixture({ isDev: true, raw }), undefined);
    }
  });
});

describe('applyHomeFixture', () => {
  it('zero-banners removes only the banners', () => {
    const base = homeData();
    const data = applyHomeFixture('zero-banners', base);

    assert.deepEqual(data.banners, []);
    assert.deepEqual(data.categories, base.categories);
    assert.deepEqual(data.sections, base.sections);
  });

  it('one-banner keeps only the first banner', () => {
    const base = homeData();
    const data = applyHomeFixture('one-banner', base);

    assert.deepEqual(data.banners, [base.banners[0]]);
    assert.deepEqual(data.sections, base.sections);
  });

  it('empty-section empties only the "new" section, keeping its entry', () => {
    const base = homeData();
    const data = applyHomeFixture('empty-section', base);

    assert.deepEqual(
      data.sections.map(({ id, items }) => [id, items.length]),
      [['best_sellers', 2], ['new', 0], ['offers', 1]],
    );
    assert.deepEqual(data.banners, base.banners);
  });

  it('all-empty empties every collection', () => {
    assert.deepEqual(applyHomeFixture('all-empty', homeData()), {
      banners: [],
      categories: [],
      sections: [],
    });
  });

  it('broken-image points every image at a path the server answers with 404', () => {
    const data = applyHomeFixture('broken-image', homeData());
    const paths = [
      ...data.banners.map(({ imageUrl }) => imageUrl),
      ...data.categories.map(({ imageUrl }) => imageUrl),
      ...data.sections.flatMap(({ items }) => items.flatMap(({ images }) => images)),
    ];

    assert.ok(paths.length > 0);
    assert.ok(paths.every((path) => path.startsWith('/images/missing/')));
    assert.equal(data.banners[0]?.title, homeData().banners[0]?.title);
  });

  it('server-fail does not transform the data (it changes the request instead)', () => {
    assert.deepEqual(applyHomeFixture('server-fail', homeData()), homeData());
  });

  it('never mutates its input', () => {
    for (const name of HOME_FIXTURES) {
      const base = homeData();
      const snapshot = structuredClone(base);

      applyHomeFixture(name, base);

      assert.deepEqual(base, snapshot, name);
    }
  });
});
