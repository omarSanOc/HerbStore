/**
 * expo-camera 57 exposes no native availability preflight. Mounting CameraView and
 * observing onCameraReady/onMountError is the supported Android/iOS capability check.
 */
export async function isCameraAvailableBeforeMount(): Promise<boolean> {
  return true;
}
