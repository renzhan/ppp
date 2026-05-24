import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthState {
  user: { id: string; email: string; name: string } | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthState['user']; token: string }>
    ) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
  },
  selectors: {
    selectUser: (state) => state.user,
    selectToken: (state) => state.token,
    selectIsAuthenticated: (state) => state.isAuthenticated,
    selectAuthLoading: (state) => state.loading,
  },
})

export const { setCredentials, logout, setLoading } = authSlice.actions
export const { selectUser, selectToken, selectIsAuthenticated, selectAuthLoading } =
  authSlice.selectors
