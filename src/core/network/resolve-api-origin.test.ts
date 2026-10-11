/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveApiOrigin } from './resolve-api-origin.ts';

describe('resolveApiOrigin defaults (port 3001)', () => {
  it('uses the emulator alias on an Android emulator', () => {
    assert.deepEqual(resolveApiOrigin({ os: 'android', isDevice: false }), {
      origin: 'http://10.0.2.2:3001',
      source: 'android-emulator',
      overrideRejected: false,
    });
  });

  it('uses localhost on a physical Android device (adb reverse)', () => {
    assert.deepEqual(resolveApiOrigin({ os: 'android', isDevice: true }), {
      origin: 'http://localhost:3001',
      source: 'android-device',
      overrideRejected: false,
    });
  });

  it('uses localhost on the iOS simulator', () => {
    assert.deepEqual(resolveApiOrigin({ os: 'ios', isDevice: false }), {
      origin: 'http://localhost:3001',
      source: 'ios-simulator',
      overrideRejected: false,
    });
  });

  it('flags a physical iOS device without override as needing one', () => {
    const resolution = resolveApiOrigin({ os: 'ios', isDevice: true });

    assert.equal(resolution.source, 'ios-device-needs-override');
    assert.equal(resolution.origin, 'http://localhost:3001');
  });

  it('falls back to localhost for any other platform', () => {
    const resolution = resolveApiOrigin({ os: 'web', isDevice: true });

    assert.equal(resolution.origin, 'http://localhost:3001');
    assert.equal(resolution.source, 'other-platform');
  });
});

describe('resolveApiOrigin override', () => {
  it('wins over every platform default', () => {
    for (const input of [
      { os: 'android', isDevice: false },
      { os: 'android', isDevice: true },
      { os: 'ios', isDevice: false },
      { os: 'ios', isDevice: true },
    ]) {
      const resolution = resolveApiOrigin({ ...input, override: 'http://192.168.1.20:3001' });

      assert.equal(resolution.origin, 'http://192.168.1.20:3001');
      assert.equal(resolution.source, 'override');
      assert.equal(resolution.overrideRejected, false);
    }
  });

  it('trims whitespace and removes trailing slashes', () => {
    assert.equal(
      resolveApiOrigin({ os: 'ios', isDevice: true, override: '  http://192.168.1.20:3001/  ' })
        .origin,
      'http://192.168.1.20:3001',
    );
    assert.equal(
      resolveApiOrigin({ os: 'ios', isDevice: true, override: 'https://api.example.test///' })
        .origin,
      'https://api.example.test',
    );
  });

  it('accepts https and hostnames without port', () => {
    assert.equal(
      resolveApiOrigin({ os: 'android', isDevice: true, override: 'https://dev.example.test' })
        .origin,
      'https://dev.example.test',
    );
  });

  it('ignores an empty or whitespace-only override without flagging it', () => {
    for (const override of [undefined, '', '   ']) {
      const resolution = resolveApiOrigin({ os: 'android', isDevice: false, override });

      assert.equal(resolution.origin, 'http://10.0.2.2:3001');
      assert.equal(resolution.overrideRejected, false);
    }
  });

  it('rejects overrides that are not a bare http(s) origin and uses the default', () => {
    for (const override of [
      'ftp://192.168.1.20:3001',
      '192.168.1.20:3001',
      'http://',
      'http://host with space:3001',
      'http://192.168.1.20:3001/api',
      'http://192.168.1.20:3001?x=1',
      'http://user@192.168.1.20:3001',
      'javascript:alert(1)',
      'http://192.168.1.20:99999',
    ]) {
      const resolution = resolveApiOrigin({ os: 'android', isDevice: false, override });

      assert.equal(resolution.origin, 'http://10.0.2.2:3001', override);
      assert.equal(resolution.source, 'android-emulator', override);
      assert.equal(resolution.overrideRejected, true, override);
    }
  });
});
