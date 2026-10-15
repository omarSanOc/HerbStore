import { resolveApiOrigin } from '../network/resolve-api-origin.ts';

export type PublicConfig =
  | { status: 'ready'; apiOrigin: string }
  | { status: 'missing' }
  | { status: 'invalid' };

type PublicConfigInput = {
  apiOrigin: string | undefined;
};

/** Pure boundary used by logic tests and by the Metro-inlined environment adapter below. */
export function resolvePublicConfig({ apiOrigin }: PublicConfigInput): PublicConfig {
  const resolution = resolveApiOrigin(apiOrigin);
  if (resolution.status !== 'ready') return resolution;
  return { status: 'ready', apiOrigin: resolution.origin };
}

// Metro only inlines EXPO_PUBLIC_* when accessed with this exact dot notation. Restart Metro after
// changing `.env.local`; never log this object or environment values.
export const publicConfig = resolvePublicConfig({
  apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN,
});
