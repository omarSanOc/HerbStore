import { i18n } from '@/core/i18n';
import { scheduleOrderNotification } from '../native/order-notifications';
import { createOrderNotificationListener } from './create-order-notification-listener';

/** The app wiring: the active i18n language and the expo-notifications boundary. */
export const orderNotificationListenerMiddleware = createOrderNotificationListener({
  getLanguage: () => (i18n.language.startsWith('es') ? 'es' : 'en'),
  schedule: scheduleOrderNotification,
});
