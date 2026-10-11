import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';

/** Catch-all for URLs of the app scheme that match no route (for example `herbstore://unknown`). */
export default function NotFoundRoute() {
  return <NotFoundScreen />;
}
