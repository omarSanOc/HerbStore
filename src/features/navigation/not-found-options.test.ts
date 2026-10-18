import assert from 'node:assert/strict';
import test from 'node:test';

import { en } from '../../core/i18n/resources/en.ts';
import { es } from '../../core/i18n/resources/es.ts';
import { notFoundScreenOptions } from './not-found-options.ts';

// H-T8-7. `+not-found` sits on top of `(tabs)`: with no `headerBackTitle` the native back button took
// its (accessible) label from the raw route group name, so VoiceOver read "(tabs)". The arrow stays
// icon-only (`minimal`) and the spoken label is a real, translated word.
for (const [language, { translation }] of [['es', es], ['en', en]] as const) {
  test(`${language}: the back button of the unrecognized-link screen is named with the translated "back", never a route group`, () => {
    const options = notFoundScreenOptions({ title: translation.notFound.title, back: translation.notFound.back });

    assert.equal(options.headerBackTitle, translation.notFound.back);
    assert.doesNotMatch(String(options.headerBackTitle), /[()]/);
    assert.equal(options.headerBackButtonDisplayMode, 'minimal');
    assert.equal(options.headerShown, true);
    assert.equal(options.title, translation.notFound.title);
  });
}
