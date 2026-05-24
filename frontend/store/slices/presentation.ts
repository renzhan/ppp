import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Slide {
  index: number
  type: 'title' | 'content' | 'chart' | 'table' | 'image'
  content: Record<string, unknown>
  layout: string
  notes: string | null
}

export interface PresentationDataState {
  id: string | null
  title: string
  slides: Slide[]
  template: string
  loading: boolean
  error: string | null
}

const initialState: PresentationDataState = {
  id: null,
  title: '',
  slides: [],
  template: 'general',
  loading: false,
  error: null,
}

export const presentationSlice = createSlice({
  name: 'presentation/data',
  initialState,
  reducers: {
    setPresentation: (
      state,
      action: PayloadAction<{ id: string; title: string; slides: Slide[]; template: string }>
    ) => {
      state.id = action.payload.id
      state.title = action.payload.title
      state.slides = action.payload.slides
      state.template = action.payload.template
    },
    setPresentationLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setPresentationError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearPresentation: (state) => {
      state.id = null
      state.title = ''
      state.slides = []
      state.template = 'general'
    },
  },
  selectors: {
    selectPresentationId: (state) => state.id,
    selectPresentationTitle: (state) => state.title,
    selectPresentationSlides: (state) => state.slides,
    selectPresentationTemplate: (state) => state.template,
    selectPresentationLoading: (state) => state.loading,
    selectPresentationError: (state) => state.error,
  },
})

export const {
  setPresentation,
  setPresentationLoading,
  setPresentationError,
  clearPresentation,
} = presentationSlice.actions
export const {
  selectPresentationId,
  selectPresentationTitle,
  selectPresentationSlides,
  selectPresentationTemplate,
  selectPresentationLoading,
  selectPresentationError,
} = presentationSlice.selectors
