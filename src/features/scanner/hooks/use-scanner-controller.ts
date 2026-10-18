import { Camera } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { toApiError } from '@/core/api/api-error';
import { onReconnect } from '@/core/network/reconnection';
import { useLazyGetProductByBarcodeQuery } from '@/features/product/data/products-api';

import { isValidEan13 } from '../logic/ean13';
import { resolveCameraAccess } from '../logic/camera-access';
import { initialScannerState, scannerReducer } from '../logic/scanner-machine';
import { createScannerReadBarrier } from '../logic/scanner-read-barrier';
import { isCameraAvailableBeforeMount } from '../native/camera-availability';

/** Camera access is deliberately an imperative action, never a hook at preview mount time. */
export function useScannerController() {
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);
  const [isOnline, setIsOnline] = useState(true);
  const [isForegroundAccessConfirmed, setIsForegroundAccessConfirmed] = useState(AppState.currentState === 'active');
  const focused = useIsFocused();
  const mounted = useRef(true);
  const requestEpoch = useRef(0);
  const activeQuery = useRef<{ abort(): void } | null>(null);
  const readBarrier = useRef(createScannerReadBarrier());
  // How many times the device came back online while this scanner was mounted. A lookup remembers
  // the count when it STARTS; see `runQuery`.
  const reconnections = useRef(0);
  const wasFocused = useRef(focused);
  const [trigger] = useLazyGetProductByBarcodeQuery();

  const invalidateQuery = useCallback(() => {
    const query = activeQuery.current;
    activeQuery.current = null;
    query?.abort();
  }, []);

  const checkAccess = useCallback(async (request: boolean) => {
    const epoch = ++requestEpoch.current;
    try {
      if (!(await isCameraAvailableBeforeMount())) {
        if (mounted.current && epoch === requestEpoch.current) {
          setIsForegroundAccessConfirmed(false);
          readBarrier.current.block();
          invalidateQuery();
          dispatch({ type: 'permissionUnavailable', reason: 'camera' });
        }
        return;
      }
      const access = await resolveCameraAccess({
        getPermission: Camera.getCameraPermissionsAsync,
        requestPermission: Camera.requestCameraPermissionsAsync,
      }, request);
      if (!mounted.current || epoch !== requestEpoch.current) return;
      if (access === 'granted') {
        setIsForegroundAccessConfirmed(AppState.currentState === 'active');
        dispatch({ type: 'permissionGranted' });
      } else {
        setIsForegroundAccessConfirmed(false);
        readBarrier.current.block();
        invalidateQuery();
        dispatch({ type: 'permissionUnavailable', reason: 'permission' });
      }
    } catch {
      if (mounted.current && epoch === requestEpoch.current) {
        setIsForegroundAccessConfirmed(false);
        readBarrier.current.block();
        invalidateQuery();
        dispatch({ type: 'permissionUnavailable', reason: 'camera' });
      }
    }
  }, [invalidateQuery]);

  const confirm = useCallback(() => {
    dispatch({ type: 'confirm' });
    void checkAccess(true);
  }, [checkAccess]);

  const runQuery = useCallback((code: string, epoch: number) => {
    const query = trigger(code);
    const reconnectionsAtStart = reconnections.current;
    activeQuery.current = query;
    void query
      .unwrap()
      .then((product) => {
        if (mounted.current && activeQuery.current === query) dispatch({ type: 'queryFinished', epoch, product });
      })
      .catch((error: unknown) => {
        if (!mounted.current || activeQuery.current !== query) return;
        // "No answer" is only evidence of being offline if the device did not report coming back
        // while the 3 attempts of this lookup were running; otherwise this failure is partly older
        // than the reconnection and must not undo it (nothing would ever set it back: the next
        // reconnection event may never come).
        if (toApiError(error)?.kind === 'network' && reconnections.current === reconnectionsAtStart) setIsOnline(false);
        dispatch({ type: 'queryFinished', epoch, error: toApiError(error) ?? { kind: 'invalid' } });
      })
      .finally(() => {
        if (activeQuery.current === query) activeQuery.current = null;
      });
  }, [trigger]);

  const readCode = useCallback((code: string) => {
    const before = state;
    if (before.kind !== 'ready') return;
    // Native callbacks can arrive twice before React commits the reducer update. Claiming the
    // current rearm synchronously makes that stale `ready` snapshot single-use.
    if (readBarrier.current.claim() === undefined) return;
    dispatch({ type: 'codeRead', code });
    if (!isValidEan13(code)) return;
    runQuery(code, before.epoch + 1);
  }, [runQuery, state]);

  const cancel = useCallback(() => {
    requestEpoch.current += 1;
    readBarrier.current.block();
    invalidateQuery();
    dispatch({ type: 'cancel' });
  }, [invalidateQuery]);

  useEffect(() => {
    const barrier = readBarrier.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestEpoch.current += 1;
      barrier.block();
      invalidateQuery();
    };
  }, [invalidateQuery]);

  useEffect(
    () =>
      onReconnect(() => {
        reconnections.current += 1;
        setIsOnline(true);
      }),
    [],
  );

  useEffect(() => {
    if (focused && !wasFocused.current && state.kind === 'ready') readBarrier.current.rearm();
    wasFocused.current = focused;
  }, [focused, state.kind]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        setIsForegroundAccessConfirmed(false);
        return;
      }
      if (state.kind !== 'preview' && state.kind !== 'closed') void checkAccess(false);
    });
    return () => subscription.remove();
  }, [checkAccess, state.kind]);

  const retry = useCallback(() => {
    // Always allowed: a lookup is a plain GET and repeating it is safe. "Offline" also covers a
    // server that is down while the system reports a connection, and no reconnection event comes
    // then, so waiting for one would trap the user (RF-17).
    dispatch({ type: 'retry' });
    if (state.kind === 'offline' || state.kind === 'timeout' || state.kind === 'temporary-error' || state.kind === 'invalid-data') {
      runQuery(state.code, state.epoch + 1);
    }
  }, [runQuery, state]);

  const mountError = useCallback((reason: string) => {
    readBarrier.current.block();
    invalidateQuery();
    setIsForegroundAccessConfirmed(false);
    dispatch({ type: 'cameraUnavailable', reason });
  }, [invalidateQuery]);

  return {
    state,
    cameraActive: focused && isForegroundAccessConfirmed,
    isOnline,
    confirm,
    readCode,
    retry,
    cancel,
    rearm: () => {
      if (state.kind === 'invalid-code' || state.kind === 'not-found') readBarrier.current.rearm();
      dispatch({ type: 'rearm' });
    },
    navigationSucceeded: () => dispatch({ type: 'navigationSucceeded' }),
    navigationFailed: () => dispatch({ type: 'navigationFailed' }),
    retryNavigation: () => dispatch({ type: 'retryNavigation' }),
    cameraReady: () => {
      if (state.kind === 'mounting-camera') readBarrier.current.rearm();
      dispatch({ type: 'cameraReady' });
    },
    mountError,
  };
}
