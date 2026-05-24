import { combineSlices, configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'

// PPP slices (top-level)
import { authSlice } from './slices/auth'
import { projectsSlice } from './slices/projects'
import { reportSlice } from './slices/report'

// Presenton slices (namespaced under 'presentation')
import { presentationSlice } from './slices/presentation'
import { editorSlice } from './slices/editor'
import { themeSlice } from './slices/theme'

// Combine Presenton slices under the 'presentation' namespace key
const presentationReducer = combineSlices(
  { reducerPath: 'data' as const, reducer: presentationSlice.reducer },
  { reducerPath: 'editor' as const, reducer: editorSlice.reducer },
  { reducerPath: 'theme' as const, reducer: themeSlice.reducer }
)

// Root reducer combining PPP slices at top level and Presenton under 'presentation'
const rootReducer = combineSlices(
  authSlice,
  projectsSlice,
  reportSlice,
  { reducerPath: 'presentation' as const, reducer: presentationReducer }
)

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
  })
}

// Type definitions
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = AppStore['dispatch']

// Typed hooks
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
