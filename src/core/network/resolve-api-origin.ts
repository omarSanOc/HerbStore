export type ApiOriginResolution =
  | { status: 'ready'; origin: string }
  | { status: 'missing' }
  | { status: 'invalid' };

/** Validates the required catalog endpoint without inventing a platform default. */
export function resolveApiOrigin(raw: string | undefined): ApiOriginResolution {
  const candidate = raw?.trim() ?? '';
  if (candidate === '') return { status: 'missing' };

  try {
    const url = new URL(candidate);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const isBareOrigin =
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === '';

    if (!isHttp || !isBareOrigin) return { status: 'invalid' };
    return { status: 'ready', origin: url.origin };
  } catch {
    return { status: 'invalid' };
  }
}
