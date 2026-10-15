import { useDispatch, useSelector, useStore } from 'react-redux';

import type { AppDispatch, AppStore, RootState } from './store';

// Typed once here, used everywhere: the Redux equivalent of a ViewModel exposing a typed state.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
// Reads the latest state inside async continuations, where a value captured at render is stale.
export const useAppStore = useStore.withTypes<AppStore>();
