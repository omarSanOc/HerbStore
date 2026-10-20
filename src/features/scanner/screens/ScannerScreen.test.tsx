/// <reference types="jest" />
// RF-17, RF-7 (T3b). What the user SEES while a barcode lookup fails, and what they can do about it:
//   - the server is down but the system says it is connected: no reconnection event will ever come,
//     so "Retry" must be there anyway;
//   - the title "Offline..." must not stay on screen after the device reports it is back;
//   - if the network returns while the 3 attempts are running, the failure that ends the round must
//     not leave the screen saying "offline" for good.
// The camera is replaced by a stub that hands the test its callbacks (`onCameraReady`,
// `onBarcodeScanned`): the real camera is checked on devices.
//
// Compose: a Compose UI test with a fake `ImageAnalysis.Analyzer`. XCUITest: a fake
// `AVCaptureMetadataOutputObjectsDelegate` that emits one code.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Camera } from 'expo-camera';

import { fontScaleLimits } from '@/design-system';
import { setAppForeground } from '@/test/app-state';
import { wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ScannerScreen } from './ScannerScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

// The `mock` prefix lets the hoisted factory read the variable.
let mockCamera: { onCameraReady?: () => void; onBarcodeScanned?: (result: { data: string; type?: string }) => void } = {};
jest.mock('expo-camera', () => ({
  Camera: { getCameraPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() },
  CameraView: (props: typeof mockCamera) => {
    mockCamera = props;
    return null;
  },
}));

/** A valid EAN-13: 2002610090004. */
const VALID = '2002610090004';
const ROUTE = `GET /products/barcode/${VALID}`;
/** Three attempts of a GET: 500 ms and 1 000 ms of backoff between them. */
const ALL_ATTEMPTS_MS = 1_500;

type Language = 'es' | 'en';

const TEXT = {
  es: {
    heading: 'Escáner de productos',
    continue: 'Continuar',
    offline: 'Sin conexión. Recupera la conexión y pulsa Reintentar.',
    reconnected: 'Conexión recuperada. Pulsa Reintentar.',
    timeout: 'Tiempo agotado. Puedes reintentar.',
    temporaryError: 'Error temporal del servidor. Puedes reintentar.',
    invalidData: 'Los datos del catálogo no son válidos. Puedes reintentar.',
    querying: 'Consultando producto…',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    found: 'Producto localizado.',
  },
  en: {
    heading: 'Product scanner',
    continue: 'Continue',
    offline: 'Offline. Restore connectivity and press Retry.',
    reconnected: 'Connection restored. Press Retry.',
    timeout: 'Timed out. You can retry.',
    temporaryError: 'Temporary server error. You can retry.',
    invalidData: 'The catalog data is invalid. You can retry.',
    querying: 'Looking up product…',
    retry: 'Retry',
    cancel: 'Cancel',
    found: 'Product found.',
  },
} as const;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('ScannerScreen: a lookup that cannot reach the server', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    mockCamera = {};
    setAppForeground(); // the camera only mounts while the app is in the foreground
    mock = createMockFetch();
    mock.install();
    jest.mocked(Camera.getCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' as never, expires: 'never' });
    jest.mocked(Camera.requestCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' as never, expires: 'never' });
  });

  afterEach(() => {
    mock.uninstall();
  });

  /** Opens the scanner and reads one valid code, the way the camera would deliver it. */
  async function scan(language: Language) {
    await renderWithProviders(<ScannerScreen />, { language });
    await fireEvent.press(screen.getByRole('button', { name: TEXT[language].continue }));
    await advance(0);
    await act(async () => {
      mockCamera.onCameraReady?.();
    });
    await act(async () => {
      mockCamera.onBarcodeScanned?.({ data: VALID });
    });
  }

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('SERVER DOWN, system connected: says offline AND offers Retry, and Retry recovers', async () => {
      mock.enqueue(ROUTE, reply.networkError(), reply.networkError(), reply.networkError());
      await scan(language);
      expect(screen.getByRole('header', { name: text.querying })).toBeOnTheScreen();

      await advance(ALL_ATTEMPTS_MS + 10);

      expect(screen.getByRole('header', { name: text.offline })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.cancel })).toBeOnTheScreen();

      mock.enqueue(ROUTE, reply.localized(wireProduct(4, { ean13: VALID, stock: 7 }), language));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/scanner/product/product-261009-004');
    });

    // T4b (RF-7): the title of every failed lookup is a translated sentence. `temporary-error` used to
    // compose the key `scanner.temporary-error` (the resource is `temporaryError`) and showed the raw key.
    it.each([
      { label: 'a 503', failure: () => reply.serverError(503), title: 'temporaryError' as const, wait: ALL_ATTEMPTS_MS },
      { label: 'a timeout', failure: () => reply.timeout(), title: 'timeout' as const, wait: 8_000 },
      { label: 'a 200 with an invalid body', failure: () => reply.localized({ nope: true }, language), title: 'invalidData' as const, wait: ALL_ATTEMPTS_MS },
    ])('$label: the title is the translated sentence, with Retry and Cancel', async ({ failure, title, wait }) => {
      mock.always(ROUTE, failure());
      await scan(language);

      await advance(wait + ALL_ATTEMPTS_MS + 10);

      expect(screen.getByRole('header', { name: text[title] })).toBeOnTheScreen();
      expect(screen.queryByText(/^scanner\./)).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.cancel })).toBeOnTheScreen();
    });

    it('RECONNECTED: the title stops saying "offline", Retry stays, and nothing is retried by itself', async () => {
      mock.always(ROUTE, reply.networkError());
      await scan(language);
      await advance(ALL_ATTEMPTS_MS + 10);
      expect(screen.getByRole('header', { name: text.offline })).toBeOnTheScreen();

      await act(async () => {
        emitReconnect();
      });

      expect(screen.queryByText(text.offline)).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.reconnected })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
      await advance(5_000);
      expect(mock.calls).toHaveLength(3);
    });

    it('RACE: the network returns during the 3 attempts -> the screen ends on "restored", not on a stale "offline"', async () => {
      mock.always(ROUTE, reply.networkError());
      await scan(language);
      await advance(600); // attempt 1 failed; attempt 2 is running

      await act(async () => {
        emitReconnect();
      });
      await advance(ALL_ATTEMPTS_MS);

      expect(screen.queryByText(text.offline)).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.reconnected })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
    });

    it('after "restored" a failed retry says "offline" again (the news is fresh, not remembered)', async () => {
      mock.always(ROUTE, reply.networkError());
      await scan(language);
      await advance(ALL_ATTEMPTS_MS + 10);
      await act(async () => {
        emitReconnect();
      });
      expect(screen.getByRole('header', { name: text.reconnected })).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(ALL_ATTEMPTS_MS + 10);

      expect(screen.getByRole('header', { name: text.offline })).toBeOnTheScreen();
    });
  });
});

// RF-15 (T6b, Day 5 T6). The states that are TEXT and buttons (the first screen with "Continue", a
// failed lookup, "no camera") live in a scroll view: at a large font the title, the message and the
// actions are taller than the screen, and at iOS AX5 "Continue" and "Close" were below the edge with
// nothing to scroll. The camera state is NOT scrollable: the preview takes the free height.
//
// Compose: `Column(Modifier.verticalScroll(rememberScrollState()))`. SwiftUI: a `ScrollView` around the `VStack`.
describe('ScannerScreen: its message states scroll', () => {
  let cameraMock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    mockCamera = {};
    setAppForeground();
    cameraMock = createMockFetch();
    cameraMock.install();
    jest.mocked(Camera.getCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' as never, expires: 'never' });
    jest.mocked(Camera.requestCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' as never, expires: 'never' });
  });

  afterEach(() => {
    cameraMock.uninstall();
  });

  it.each<Language>(['es', 'en'])('the first screen (preview, in %s) keeps "Continue" and "Close" inside a ScrollView', async (language) => {
    await renderWithProviders(<ScannerScreen />, { language });

    const scroll = screen.getByTestId('scanner-message-scroll');
    expect(within(scroll).getByRole('header', { name: TEXT[language].heading })).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: TEXT[language].continue })).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: language === 'es' ? 'Cerrar' : 'Close' })).toBeOnTheScreen();
  });

  it('the camera state is NOT scrollable: the preview fills the free height and "Cancel" stays in view', async () => {
    await renderWithProviders(<ScannerScreen />, { language: 'en' });
    await fireEvent.press(screen.getByRole('button', { name: TEXT.en.continue }));
    await advance(0);
    await act(async () => {
      mockCamera.onCameraReady?.();
    });

    expect(screen.queryByTestId('scanner-message-scroll')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: TEXT.en.cancel })).toBeOnTheScreen();
  });

  it('configures CameraView for both EAN-13 and QR without changing the accessible flow', async () => {
    await renderWithProviders(<ScannerScreen />, { language: 'en' });
    await fireEvent.press(screen.getByRole('button', { name: TEXT.en.continue }));
    await advance(0);
    await act(async () => {
      mockCamera.onCameraReady?.();
    });

    expect(mockCamera).toHaveProperty('barcodeScannerSettings', { barcodeTypes: ['ean13', 'qr'] });
    expect(screen.getByRole('button', { name: TEXT.en.cancel })).toBeOnTheScreen();
  });

  it.each<Language>(['es', 'en'])('shows an accessible localized invalid-code state for a rejected QR without a request (%s)', async (language) => {
    const text = TEXT[language];
    await renderWithProviders(<ScannerScreen />, { language });
    await fireEvent.press(screen.getByRole('button', { name: text.continue }));
    await advance(0);
    await act(async () => {
      mockCamera.onCameraReady?.();
    });
    await act(async () => {
      mockCamera.onBarcodeScanned?.({ type: 'qr', data: 'https://example.test/not-a-product' });
    });

    expect(screen.getByRole('header', { name: language === 'es' ? 'El código no es un EAN-13 válido.' : 'The code is not a valid EAN-13.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: language === 'es' ? 'Aceptar' : 'OK' })).toBeOnTheScreen();
    expect(cameraMock.calls).toHaveLength(0);
  });

  // The title of every state is one or two long words ("Consultando producto…"): at iOS AX5 (about 3.5x,
  // 100 pt) "Consultando" was split as "Consultand / o". It scales only up to `fontScaleLimits.screenTitle`.
  it('caps the font scale of the title in the first screen and in the camera state', async () => {
    await renderWithProviders(<ScannerScreen />, { language: 'es' });

    expect(screen.getByRole('header', { name: TEXT.es.heading })).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.screenTitle);

    await fireEvent.press(screen.getByRole('button', { name: TEXT.es.continue }));
    await advance(0);
    await act(async () => {
      mockCamera.onCameraReady?.();
    });

    for (const node of screen.getAllByRole('header')) {
      expect(node).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.screenTitle);
    }
    expect(fontScaleLimits.screenTitle).toBe(2);
  });
});
