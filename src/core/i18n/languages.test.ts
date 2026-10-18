/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSupportedLanguage, resolveDeviceLanguage, supportedLanguages } from './languages.ts';

describe('languages', () => {
  it('the app speaks Spanish and English', () => {
    assert.deepEqual([...supportedLanguages], ['es', 'en']);
  });

  it('isSupportedLanguage is strict', () => {
    assert.equal(isSupportedLanguage('es'), true);
    assert.equal(isSupportedLanguage('en'), true);
    for (const value of ['EN', 'en-US', 'fr', '', undefined, null, 1]) assert.equal(isSupportedLanguage(value), false);
  });

  it('the device language is English for en and Spanish for everything else (the fallback)', () => {
    assert.equal(resolveDeviceLanguage('en'), 'en');
    assert.equal(resolveDeviceLanguage('es'), 'es');
    for (const code of ['fr', 'pt', '', undefined, null]) assert.equal(resolveDeviceLanguage(code), 'es');
  });
});
