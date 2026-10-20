/// <reference types="jest" />
// RF-4, RF-5 (T3a), RF-17 (T3b). The scanner's ViewModel, driven the way the screen drives it (confirm ->
// permission -> camera ready -> a code is read), over the real RTK Query stack and a controlled
// `fetch`. The hook is the ONLY thing between a barcode the camera produced and a request to the
// server, so its guard is tested directly here:
//   - a code that is not a valid EAN-13 never reaches the network (the "isValidEan13 guard"),
//   - two callbacks of the same camera frame ask once,
//   - leaving the scanner cancels what is in flight.
// The pure pieces (`isValidEan13`, the machine, the barrier) have their own `node:test` tables.
//
// Compose: a `ViewModel` test with a fake `CameraX` analyzer that emits barcodes and `runTest`.
// SwiftUI: an `@Observable` model fed by a fake `AVCaptureMetadataOutput` delegate.
import { act, renderHook } from '@testing-library/react-native';
import { Camera, type PermissionResponse } from 'expo-camera';
import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';

import { i18n } from '@/core/i18n';
import { createTestStore, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';

import { useScannerController } from './use-scanner-controller';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);
jest.mock('expo-camera', () => ({
  Camera: { getCameraPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() },
}));

/** A valid EAN-13: 2002610090004 (checksum digit 4). */
const VALID = '2002610090004';

const permission = (granted: boolean, canAskAgain = true): PermissionResponse => ({
  granted,
  canAskAgain,
  // The module is mocked, so its `PermissionStatus` enum does not exist here: its string values do.
  status: (granted ? 'granted' : 'denied') as PermissionResponse['status'],
  expires: 'never',
});

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('useScannerController', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    // The controller asks for the barcode in the current language, so the test fixes it BEFORE the
    // fake clock starts (`changeLanguage` must not race a frozen timer).
    await i18n.changeLanguage('es');
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    mock = createMockFetch();
    mock.install();
    store = createTestStore();
    jest.mocked(Camera.getCameraPermissionsAsync).mockResolvedValue(permission(true));
    jest.mocked(Camera.requestCameraPermissionsAsync).mockResolvedValue(permission(true));
  });

  afterEach(() => {
    mock.uninstall();
  });

  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <ReduxProvider store={store}>{children}</ReduxProvider>
  );
  const barcodeRequests = () => mock.calls.filter(({ path }) => path.startsWith('/products/barcode/'));

  /** Mounts the hook and takes it to `ready`, the state in which the camera may deliver a code. */
  async function readyScanner() {
    const view = await renderHook(() => useScannerController(), { wrapper });
    expect(view.result.current.state.kind).toBe('preview');

    await act(async () => {
      view.result.current.confirm();
    });
    await advance(0);
    expect(view.result.current.state.kind).toBe('mounting-camera');

    await act(async () => {
      view.result.current.cameraReady();
    });
    expect(view.result.current.state.kind).toBe('ready');
    return view;
  }

  describe('permission', () => {
    it('starts on the preview and does NOT ask the camera anything until the user confirms', async () => {
      const { result } = await renderHook(() => useScannerController(), { wrapper });

      expect(result.current.state.kind).toBe('preview');
      expect(Camera.getCameraPermissionsAsync).not.toHaveBeenCalled();
      expect(Camera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    });

    it('a denied permission ends in "unavailable" and never mounts the camera', async () => {
      jest.mocked(Camera.getCameraPermissionsAsync).mockResolvedValue(permission(false, false));
      const { result } = await renderHook(() => useScannerController(), { wrapper });

      await act(async () => {
        result.current.confirm();
      });
      await advance(0);

      expect(result.current.state.kind).toBe('unavailable');
      expect(result.current.cameraActive).toBe(false);
      expect(Camera.requestCameraPermissionsAsync).not.toHaveBeenCalled(); // canAskAgain is false
    });
  });

  describe('the EAN-13 guard: a code that is not valid never reaches the network', () => {
    it.each([
      ['wrong check digit', '2002610090001'],
      ['12 digits', '200261009000'],
      ['14 digits', '20026100900044'],
      ['a letter inside', '20026100900A4'],
      ['empty', ''],
      ['a leading space', ' 2002610090004'],
      ['a trailing newline', '2002610090004\n'],
      ['full-width digits', '２００２６１００９０００４'],
      ['QR payload instead of a barcode', 'https://example.test/p/1'],
    ])('%s -> "invalid code", and ZERO requests', async (_label, code) => {
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode(code);
      });
      await advance(2_000);

      expect(result.current.state).toMatchObject({ kind: 'invalid-code' });
      expect(barcodeRequests()).toHaveLength(0);
      expect(mock.calls).toHaveLength(0);
    });

    it('after an invalid read the user can scan again, and a valid code then queries once', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es'));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode('2002610090001');
      });
      expect(result.current.state.kind).toBe('invalid-code');

      await act(async () => {
        result.current.rearm();
      });
      expect(result.current.state.kind).toBe('ready');
      await act(async () => {
        result.current.readCode(VALID);
      });
      await advance(10);

      expect(barcodeRequests()).toHaveLength(1);
      expect(result.current.state).toMatchObject({ kind: 'navigating', code: VALID });
    });

    it('a valid code queries the server once and the found product is the one to open', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es', { delayMs: 500 }));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode(VALID);
      });
      expect(result.current.state).toMatchObject({ kind: 'querying', code: VALID });
      await advance(510);

      expect(barcodeRequests().map(({ path }) => path)).toEqual([`/products/barcode/${VALID}`]);
      expect(result.current.state).toMatchObject({
        kind: 'navigating',
        product: { id: 'product-261009-004', stock: 7 },
      });
    });

    it('a valid QR payload is trimmed, queried through the barcode endpoint, and opens the product', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es'));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode({ type: 'qr', data: `  ${VALID}\n` });
      });
      await advance(10);

      expect(barcodeRequests().map(({ path }) => path)).toEqual([`/products/barcode/${VALID}`]);
      expect(result.current.state).toMatchObject({ kind: 'navigating', code: VALID });
    });

    it('a valid but unknown QR payload uses the barcode endpoint and shows not found without retrying', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.clientError(404, { error: 'not found' }));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode({ type: 'qr', data: `\t${VALID}  ` });
      });
      await advance(10);

      expect(result.current.state).toMatchObject({ kind: 'not-found', code: VALID });
      expect(barcodeRequests()).toHaveLength(1);
    });

    it.each([
      'https://example.test/products/product-261009-004',
      'product-261009-004',
      'herbstore://scanner/product-261009-004',
      '200261 0090004',
    ])('rejects a QR payload %s without a request', async (data) => {
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode({ type: 'qr', data });
      });
      await advance(2_000);

      expect(result.current.state.kind).toBe('invalid-code');
      expect(mock.calls).toHaveLength(0);
    });
  });

  describe('one frame, one request', () => {
    it('two callbacks for the same frame (same JS turn) query ONCE', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es'));
      const { result } = await readyScanner();
      const readCode = result.current.readCode; // the closure the camera holds: it sees `ready`

      await act(async () => {
        readCode(VALID);
        readCode(VALID);
        readCode('2002610090011');
      });
      await advance(10);

      expect(barcodeRequests()).toHaveLength(1);
    });
  });

  describe('outcomes of the query', () => {
    it('an unknown product (404) is "not found" and the user can scan again', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.clientError(404, { error: 'not found' }));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode(VALID);
      });
      await advance(10);

      expect(result.current.state).toMatchObject({ kind: 'not-found', code: VALID });
      expect(barcodeRequests()).toHaveLength(1); // a 404 is final: no automatic retry
      await act(async () => {
        result.current.rearm();
      });
      expect(result.current.state.kind).toBe('ready');
    });
  });

  describe('offline (RF-17)', () => {
    /** The three attempts of a GET (the read policy waits 500 ms and then 1 000 ms between them). */
    const ALL_ATTEMPTS_MS = 1_500;
    const lookup = (view: Awaited<ReturnType<typeof readyScanner>>) =>
      act(async () => {
        view.result.current.readCode(VALID);
      });

    it('the server is down but the system is connected: after the 3 attempts it is "offline" and the user CAN retry', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.networkError(), reply.networkError(), reply.networkError());
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es'));
      const view = await readyScanner();

      await lookup(view);
      await advance(ALL_ATTEMPTS_MS + 10);

      expect(barcodeRequests()).toHaveLength(3);
      expect(view.result.current.state).toMatchObject({ kind: 'offline', code: VALID });
      expect(view.result.current.isOnline).toBe(false);

      // No reconnection event ever came: the system never reported a change.
      await act(async () => {
        view.result.current.retry();
      });
      await advance(10);

      expect(barcodeRequests()).toHaveLength(4);
      expect(view.result.current.state).toMatchObject({ kind: 'navigating', product: { id: 'product-261009-004' } });
    });

    it('a retry that fails again stays "offline" with one more round of attempts, never a loop', async () => {
      mock.always(`GET /products/barcode/${VALID}`, reply.networkError());
      const view = await readyScanner();
      await lookup(view);
      await advance(ALL_ATTEMPTS_MS + 10);

      await act(async () => {
        view.result.current.retry();
      });
      await advance(ALL_ATTEMPTS_MS + 10);
      await advance(10_000);

      expect(barcodeRequests()).toHaveLength(6);
      expect(view.result.current.state.kind).toBe('offline');
      expect(view.result.current.isOnline).toBe(false);
    });

    it('a reconnection after "offline" flips the connectivity flag, so the title can stop saying "no connection"', async () => {
      mock.always(`GET /products/barcode/${VALID}`, reply.networkError());
      const view = await readyScanner();
      await lookup(view);
      await advance(ALL_ATTEMPTS_MS + 10);
      expect(view.result.current.isOnline).toBe(false);

      await act(async () => {
        emitReconnect();
      });

      expect(view.result.current.isOnline).toBe(true);
      expect(view.result.current.state.kind).toBe('offline'); // it never retries by itself
      expect(barcodeRequests()).toHaveLength(3);
    });

    it('RACE: the network returns DURING the 3 attempts -> the outcome is not left as "still offline"', async () => {
      mock.always(`GET /products/barcode/${VALID}`, reply.networkError());
      const view = await readyScanner();
      await lookup(view);
      await advance(600); // attempt 1 failed, attempt 2 is running (after the 500 ms backoff)
      expect(view.result.current.state.kind).toBe('querying');

      await act(async () => {
        emitReconnect();
      });
      await advance(ALL_ATTEMPTS_MS);

      expect(view.result.current.state.kind).toBe('offline');
      // The failure that ends the round predates part of the reconnection: it must not undo it.
      expect(view.result.current.isOnline).toBe(true);
    });

    it('RACE: a reconnection BEFORE the lookup starts does not hide a failure that happens afterwards', async () => {
      mock.always(`GET /products/barcode/${VALID}`, reply.networkError());
      const view = await readyScanner();
      await act(async () => {
        emitReconnect();
      });

      await lookup(view);
      await advance(ALL_ATTEMPTS_MS + 10);

      expect(view.result.current.isOnline).toBe(false);
    });

    it.each([
      { label: 'timeout', failure: reply.timeout(), kind: 'timeout' },
      { label: '503', failure: reply.serverError(503), kind: 'temporary-error' },
      { label: '200 with an invalid body', failure: reply.localized({ nope: true }, 'es'), kind: 'invalid-data' },
    ])('$label -> "$kind" and a retry asks the server again', async ({ failure, kind }) => {
      mock.always(`GET /products/barcode/${VALID}`, failure);
      const view = await readyScanner();
      await lookup(view);
      await advance(8_000 + ALL_ATTEMPTS_MS + 10);

      expect(view.result.current.state.kind).toBe(kind);
      const before = barcodeRequests().length;

      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es'));
      await act(async () => {
        view.result.current.retry();
      });
      await advance(10);

      expect(barcodeRequests()).toHaveLength(before + 1);
      expect(view.result.current.state.kind).toBe('navigating');
    });
  });

  describe('leaving', () => {
    it('cancelling while the product is being looked up ends in "closed" and the late answer opens nothing', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es', { delayMs: 3_000 }));
      const { result } = await readyScanner();

      await act(async () => {
        result.current.readCode(VALID);
      });
      await advance(1_000);
      expect(result.current.state.kind).toBe('querying');

      await act(async () => {
        result.current.cancel();
      });
      await advance(5_000);

      expect(result.current.state.kind).toBe('closed');
    });

    it('unmounting while a lookup is in flight leaves no work running and no state update', async () => {
      mock.enqueue(`GET /products/barcode/${VALID}`, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), 'es', { delayMs: 3_000 }));
      const view = await readyScanner();
      await act(async () => {
        view.result.current.readCode(VALID);
      });
      await advance(500);

      await view.unmount();
      const errors = jest.spyOn(console, 'error');
      errors.mockClear();
      await advance(5_000);

      // React 19 reports no "update on an unmounted component"; any error here would be ours.
      expect(errors).not.toHaveBeenCalled();
    });
  });
});
