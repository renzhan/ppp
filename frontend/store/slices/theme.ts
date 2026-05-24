import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ThemeState {
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  background: string
  availableThemes: string[]
}

const initialState: ThemeState = {
  primaryColor: '#1a73e8',
  secondaryColor: '#4285f4',
  fontFamily: 'Inter',
  background: '#ffffff',
  availableThemes: [],
}

export const themeSlice = createSlice({
  name: 'presentation/theme',
  initialState,
  reducers: {
    setTheme: (
      state,
      action: PayloadAction<{
        primaryColor: string
        secondaryColor: string
        fontFamily: string
        background: string
      }>
    ) => {
      state.primaryColor = action.payload.primaryColor
      state.secondaryColor = action.payload.secondaryColor
      state.fontFamily = action.payload.fontFamily
      state.background = action.payload.background
    },
    setAvailableThemes: (state, action: PayloadAction<string[]>) => {
      state.availableThemes = action.payload
    },
  },
  selectors: {
    selectPrimaryColor: (state) => state.primaryColor,
    selectSecondaryColor: (state) => state.secondaryColor,
    selectFontFamily: (state) => state.fontFamily,
    selectBackground: (state) => state.background,
    selectAvailableThemes: (state) => state.availableThemes,
  },
})

export const { setTheme, setAvailableThemes } = themeSlice.actions
export const {
  selectPrimaryColor,
  selectSecondaryColor,
  selectFontFamily,
  selectBackground,
  selectAvailableThemes,
} = themeSlice.selectors
