// What the immediate local notification of a confirmed order carries (spec 005, RF-24, RNF-1).
//
// Text comes from the i18n resources, so `parity.test.ts` guards both languages. The content is a
// closed shape: title, body and `{ destination: 'home' }`. It deliberately has no input besides the
// language, so no order id, address or other sensitive datum can reach the public surface.

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';

export type NotificationLanguage = 'es' | 'en';
export type HomeNotificationPayload = Readonly<{ destination: 'home' }>;

const COPY = { es: es.translation.notifications, en: en.translation.notifications } as const;

export function buildNotificationContent(language: NotificationLanguage) {
  const { orderConfirmed } = COPY[language];
  return { title: orderConfirmed.title, body: orderConfirmed.body, data: { destination: 'home' as const } };
}

/** Name of the Android channel as Settings shows it, in the active language. */
export function notificationChannelName(language: NotificationLanguage): string {
  return COPY[language].channelName;
}

export function isHomeNotificationPayload(value: unknown): value is HomeNotificationPayload {
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length === 1 && entries[0]?.[0] === 'destination' && entries[0]?.[1] === 'home';
}
