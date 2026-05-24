import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface EditorState {
  activeSlideIndex: number
  isEditing: boolean
  selectedElementId: string | null
  zoom: number
  showNotes: boolean
}

const initialState: EditorState = {
  activeSlideIndex: 0,
  isEditing: false,
  selectedElementId: null,
  zoom: 100,
  showNotes: false,
}

export const editorSlice = createSlice({
  name: 'presentation/editor',
  initialState,
  reducers: {
    setActiveSlide: (state, action: PayloadAction<number>) => {
      state.activeSlideIndex = action.payload
    },
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload
    },
    selectElement: (state, action: PayloadAction<string | null>) => {
      state.selectedElementId = action.payload
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload
    },
    toggleNotes: (state) => {
      state.showNotes = !state.showNotes
    },
  },
  selectors: {
    selectActiveSlideIndex: (state) => state.activeSlideIndex,
    selectIsEditing: (state) => state.isEditing,
    selectSelectedElementId: (state) => state.selectedElementId,
    selectEditorZoom: (state) => state.zoom,
    selectShowNotes: (state) => state.showNotes,
  },
})

export const { setActiveSlide, setEditing, selectElement, setZoom, toggleNotes } =
  editorSlice.actions
export const {
  selectActiveSlideIndex,
  selectIsEditing,
  selectSelectedElementId,
  selectEditorZoom,
  selectShowNotes,
} = editorSlice.selectors
