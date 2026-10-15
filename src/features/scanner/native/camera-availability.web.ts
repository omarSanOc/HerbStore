import { CameraView } from 'expo-camera';

/** Web is the only expo-camera 57 platform that supports this preflight. */
export function isCameraAvailableBeforeMount(): Promise<boolean> {
  return CameraView.isAvailableAsync();
}
