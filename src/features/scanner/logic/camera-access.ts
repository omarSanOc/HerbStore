export type CameraPermissionSnapshot = Readonly<{
  granted: boolean;
  canAskAgain: boolean;
}>;

type CameraPermissionDependencies = Readonly<{
  getPermission: () => Promise<CameraPermissionSnapshot>;
  requestPermission: () => Promise<CameraPermissionSnapshot>;
}>;

export type CameraAccessResult = 'granted' | 'unavailable';

/**
 * Resolves permission without a hardware preflight. CameraView mounting is the supported
 * capability check on native; initialization failures arrive through onMountError.
 */
export async function resolveCameraAccess(
  dependencies: CameraPermissionDependencies,
  request: boolean,
): Promise<CameraAccessResult> {
  let permission = await dependencies.getPermission();
  if (!permission.granted && request && permission.canAskAgain) {
    permission = await dependencies.requestPermission();
  }
  return permission.granted ? 'granted' : 'unavailable';
}
