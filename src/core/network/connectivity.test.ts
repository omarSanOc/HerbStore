/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isOnline, isReconnection, type ConnectivitySnapshot } from './connectivity.ts';

const online: ConnectivitySnapshot = { isConnected: true, isInternetReachable: true };
const offline: ConnectivitySnapshot = { isConnected: false, isInternetReachable: false };

describe('isOnline', () => {
  it('is online when connected and the internet is reachable, unknown or absent', () => {
    assert.equal(isOnline({ isConnected: true, isInternetReachable: true }), true);
    assert.equal(isOnline({ isConnected: true, isInternetReachable: null }), true);
    assert.equal(isOnline({ isConnected: true }), true);
  });

  it('is offline when not connected or when the internet is not reachable', () => {
    assert.equal(isOnline({ isConnected: false, isInternetReachable: true }), false);
    assert.equal(isOnline({ isConnected: false }), false);
    assert.equal(isOnline({ isConnected: true, isInternetReachable: false }), false);
  });

  it('does not call an unknown state online', () => {
    assert.equal(isOnline({}), false);
    assert.equal(isOnline({ isConnected: null }), false);
  });
});

describe('isReconnection', () => {
  it('is a reconnection only for offline then online', () => {
    assert.equal(isReconnection(offline, online), true);
    assert.equal(isReconnection({ isConnected: true, isInternetReachable: false }, online), true);
    assert.equal(isReconnection({ isConnected: false }, { isConnected: true }), true);
  });

  it('is not a reconnection for online to online, online to offline or offline to offline', () => {
    assert.equal(isReconnection(online, online), false);
    assert.equal(isReconnection(online, offline), false);
    assert.equal(isReconnection(offline, offline), false);
  });

  it('is never a reconnection without a previous state', () => {
    assert.equal(isReconnection(undefined, online), false);
  });

  it('is not a reconnection when the previous state was merely unknown', () => {
    assert.equal(isReconnection({}, online), false);
    assert.equal(isReconnection({ isConnected: null, isInternetReachable: null }, online), false);
  });

  it('does not fire while the next state is still offline or unknown', () => {
    assert.equal(isReconnection(offline, {}), false);
    assert.equal(isReconnection(offline, { isConnected: true, isInternetReachable: false }), false);
  });
});
