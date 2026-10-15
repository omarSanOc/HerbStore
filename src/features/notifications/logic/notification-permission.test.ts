import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNotificationPermission, classifyUnusableReason, toPermissionInput } from './notification-permission.ts';

test('classifies Android runtime permission states', () => {
  assert.equal(classifyNotificationPermission({ platform: 'android', status: 'undetermined', canAskAgain: true, hasRuntimePrompt: true }).kind, 'request');
  assert.equal(classifyNotificationPermission({ platform: 'android', status: 'denied', canAskAgain: false, hasRuntimePrompt: true }).kind, 'unusable');
  assert.equal(classifyNotificationPermission({ platform: 'android', status: 'granted', canAskAgain: false, hasRuntimePrompt: true }).kind, 'usable');
});

test('Android without a runtime dialog remains usable when the OS grants capability', () => {
  assert.equal(classifyNotificationPermission({ platform: 'android', status: 'denied', canAskAgain: false, hasRuntimePrompt: false, effective: true }).kind, 'usable');
});

test('iOS provisional and ephemeral authorization are usable', () => {
  assert.equal(classifyNotificationPermission({ platform: 'ios', status: 'provisional', canAskAgain: false }).kind, 'usable');
  assert.equal(classifyNotificationPermission({ platform: 'ios', status: 'ephemeral', canAskAgain: false }).kind, 'usable');
});

// ---------------------------------------------------------------------------------------------
// The shapes expo-notifications 57.0.22 REALLY returns (read from its Kotlin/Swift sources), mapped
// onto the classifier input. The matrix below is the "Hecho cuando" of T8: Android with a runtime
// dialog, Android without one, and iOS authorized|provisional|ephemeral|denied|notDetermined.
// ---------------------------------------------------------------------------------------------

const android13 = { platform: 'android', apiLevel: 33 } as const;
const android12 = { platform: 'android', apiLevel: 32 } as const;
const ios = { platform: 'ios' } as const;

test('Android 13+ reports a fresh install as denied with canAskAgain and that still asks once', () => {
  // NotificationPermissionsModule.kt: without POST_NOTIFICATIONS `areNotificationsEnabled()` is false,
  // so the module answers DENIED even though nothing was ever asked (UNDETERMINED never surfaces).
  const fresh = toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android13);
  assert.deepEqual(classifyNotificationPermission(fresh), { kind: 'request' });
});

test('Android 13+ keeps asking after the first denial and opens Settings once the system blocks the dialog', () => {
  const rationale = toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android13);
  assert.deepEqual(classifyNotificationPermission(rationale), { kind: 'request' });
  const blocked = toPermissionInput({ status: 'denied', granted: false, canAskAgain: false }, android13);
  assert.deepEqual(classifyNotificationPermission(blocked), { kind: 'unusable', canOpenSettings: true });
});

test('Android 13+ granted is usable and undetermined asks', () => {
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'granted', granted: true, canAskAgain: true }, android13)), { kind: 'usable' });
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'undetermined', granted: false, canAskAgain: true }, android13)), { kind: 'request' });
});

test('Android 13+ with the runtime permission granted but notifications switched off opens Settings and never asks', () => {
  const disabled = toPermissionInput({ status: 'denied', granted: true, canAskAgain: true }, android13);
  assert.deepEqual(classifyNotificationPermission(disabled), { kind: 'unusable', canOpenSettings: true });
});

test('Android below 13 has no dialog: enabled is usable, disabled opens Settings and never asks', () => {
  assert.equal(toPermissionInput({ status: 'granted', granted: true, canAskAgain: true }, android12).hasRuntimePrompt, false);
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'granted', granted: true, canAskAgain: true }, android12)), { kind: 'usable' });
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'denied', granted: false, canAskAgain: false }, android12)), { kind: 'unusable', canOpenSettings: true });
  // Even if a build reported canAskAgain there, no dialog exists on that variant.
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android12)), { kind: 'unusable', canOpenSettings: true });
});

test('the runtime dialog starts at API 33', () => {
  assert.equal(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, { platform: 'android', apiLevel: 32 }).hasRuntimePrompt, false);
  assert.equal(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, { platform: 'android', apiLevel: 33 }).hasRuntimePrompt, true);
  assert.equal(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, { platform: 'android', apiLevel: 36 }).hasRuntimePrompt, true);
  // An unknown level is treated as the variant WITHOUT a dialog: it never asks blindly.
  assert.equal(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, { platform: 'android' }).hasRuntimePrompt, false);
});

test('iOS reads ios.status: authorized, provisional and ephemeral are usable; denied opens Settings; notDetermined asks', () => {
  // ExpoNotificationsPermissionsRequester.swift: only `.authorized` becomes top-level `granted`;
  // `.provisional` and `.ephemeral` surface as top-level `undetermined`, so ios.status must decide.
  const cases = [
    [{ status: 'undetermined', canAskAgain: true, ios: { status: 0 } }, { kind: 'request' }],
    [{ status: 'denied', canAskAgain: false, ios: { status: 1 } }, { kind: 'unusable', canOpenSettings: true }],
    [{ status: 'granted', canAskAgain: true, ios: { status: 2 } }, { kind: 'usable' }],
    [{ status: 'undetermined', canAskAgain: true, ios: { status: 3 } }, { kind: 'usable' }],
    [{ status: 'undetermined', canAskAgain: true, ios: { status: 4 } }, { kind: 'usable' }],
  ] as const;
  for (const [response, expected] of cases) {
    assert.deepEqual(classifyNotificationPermission(toPermissionInput(response, ios)), expected, `ios.status=${response.ios.status}`);
  }
});

test('iOS without ios.status falls back to the top-level status and an unknown ios.status is not usable', () => {
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'granted', canAskAgain: true }, ios)), { kind: 'usable' });
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'undetermined', canAskAgain: true }, ios)), { kind: 'request' });
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'undetermined', canAskAgain: true, ios: { status: 99 } }, ios)), { kind: 'unusable', canOpenSettings: true });
});

test('a status the SDK does not define is never usable and never asks', () => {
  assert.deepEqual(classifyNotificationPermission(toPermissionInput({ status: 'surprise', granted: true, canAskAgain: true }, android13)), { kind: 'unusable', canOpenSettings: true });
});

test('iOS never asks again after the first answer, whatever canAskAgain says', () => {
  assert.deepEqual(classifyNotificationPermission({ platform: 'ios', status: 'denied', canAskAgain: true }), { kind: 'unusable', canOpenSettings: true });
});

// ---------------------------------------------------------------------------------------------
// RF-39 (H-T8-4): which text an unusable order shows. «Denegadas recuperables» only exists on Android
// with the runtime dialog while the system can still show it again; everything else is «bloqueadas».
// The reason is derived from the LAST permission reading of the evaluation (the request answer if
// the order asked, `getPermissionsAsync` otherwise), with the real expo-notifications 57 shapes.
// ---------------------------------------------------------------------------------------------

test('Android 13+ denied with canAskAgain (first denial, dialog still possible) is recoverable', () => {
  const firstDenial = toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android13);
  assert.equal(classifyUnusableReason(firstDenial), 'denied-recoverable');
});

test('Android 13+ denied without canAskAgain (the system no longer shows the dialog) is blocked', () => {
  const secondDenial = toPermissionInput({ status: 'denied', granted: false, canAskAgain: false }, android13);
  assert.equal(classifyUnusableReason(secondDenial), 'blocked');
});

test('Android 13+ with the runtime permission granted but app notifications switched off is blocked', () => {
  const switchedOff = toPermissionInput({ status: 'denied', granted: true, canAskAgain: true }, android13);
  assert.equal(classifyUnusableReason(switchedOff), 'blocked');
});

test('Android below 13 (no runtime dialog, deterministic variant) switched off is blocked even if canAskAgain', () => {
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'denied', granted: false, canAskAgain: false }, android12)), 'blocked');
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android12)), 'blocked');
  // An unknown API level is the variant WITHOUT a dialog.
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, { platform: 'android' })), 'blocked');
});

test('iOS is always blocked once unusable: denied after the answer, and notDetermined whose request was already used', () => {
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'denied', canAskAgain: false, ios: { status: 1 } }, ios)), 'blocked');
  // The order already used its single request: the dialog could still appear, but never for this order.
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'undetermined', canAskAgain: true, ios: { status: 0 } }, ios)), 'blocked');
  assert.equal(classifyUnusableReason({ platform: 'ios', status: 'denied', canAskAgain: true }), 'blocked');
});

test('an unknown state is blocked: an unknown status, an unknown ios.status', () => {
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'surprise', granted: false, canAskAgain: true }, android13)), 'blocked');
  assert.equal(classifyUnusableReason(toPermissionInput({ status: 'undetermined', canAskAgain: true, ios: { status: 99 } }, ios)), 'blocked');
});

test('the recoverable reason matches exactly the Android 13+ "request" decision of the existing matrix', () => {
  const inputs = [
    toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android13),
    toPermissionInput({ status: 'undetermined', granted: false, canAskAgain: true }, android13),
    toPermissionInput({ status: 'denied', granted: false, canAskAgain: false }, android13),
    toPermissionInput({ status: 'denied', granted: true, canAskAgain: true }, android13),
    toPermissionInput({ status: 'denied', granted: false, canAskAgain: true }, android12),
    toPermissionInput({ status: 'undetermined', canAskAgain: true, ios: { status: 0 } }, ios),
  ];
  for (const input of inputs) {
    const expected = input.platform === 'android' && input.hasRuntimePrompt === true && classifyNotificationPermission(input).kind === 'request'
      ? 'denied-recoverable'
      : 'blocked';
    assert.equal(classifyUnusableReason(input), expected, JSON.stringify(input));
  }
});
