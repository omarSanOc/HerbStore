import { publicConfig } from '@/core/config/public-config';

/**
 * The gate prevents the store/API from mounting unless this value is ready. An empty string is a
 * deliberately unusable value, not a network fallback; it cannot disclose or imply another host.
 */
export const apiOrigin = publicConfig.status === 'ready' ? publicConfig.apiOrigin : '';
