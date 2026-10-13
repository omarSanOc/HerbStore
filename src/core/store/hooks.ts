import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from './store';

// Typed once here, used everywhere: the Redux equivalent of a ViewModel exposing a typed state.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
