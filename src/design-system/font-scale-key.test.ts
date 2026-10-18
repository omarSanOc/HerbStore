/// <reference types="node" />
// H-10 (= N-4, spec 006 T6c). On iOS, changing the text size while the app is open leaves every `Text`
// with the box it measured at the old size, so the new, larger glyphs are cut. React Native updates the
// layout context but does not mark the text nodes dirty, so nothing re-measures. A text node that is
// REMOUNTED does. The key that remounts it is the font scale; on Android the system relaunches the
// Activity on a font change (no `fontScale` in `configChanges`), so the key is not needed there.
//
// Android: `onConfigurationChanged` / Activity recreation; iOS: `UIContentSizeCategory.didChangeNotification`
// (`traitCollectionDidChange`) + `invalidateIntrinsicContentSize()`; Compose recomposes by itself.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { textRemeasureKey } from './font-scale-key.ts';

describe('textRemeasureKey', () => {
  it('is the font scale on iOS, so a change of size remounts (re-measures) the text', () => {
    assert.equal(textRemeasureKey('ios', 1), 1);
    assert.equal(textRemeasureKey('ios', 3.1), 3.1);
    assert.notEqual(textRemeasureKey('ios', 1), textRemeasureKey('ios', 1.3));
  });

  it('is the same key for the same scale (no remount without a change)', () => {
    assert.equal(textRemeasureKey('ios', 1.5), textRemeasureKey('ios', 1.5));
  });

  it('is undefined on Android and on the web: the platform already restarts the screen or re-measures', () => {
    assert.equal(textRemeasureKey('android', 2), undefined);
    assert.equal(textRemeasureKey('web', 2), undefined);
  });
});
