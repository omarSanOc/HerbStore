import { requestLightImpact } from '../native/haptics';
import { createCartFeedbackListener } from './cart-feedback-listener';

/** The app's wiring: cart mutations that really changed the lines request one light impact. */
export const nativeFeedbackListenerMiddleware = createCartFeedbackListener(requestLightImpact);
