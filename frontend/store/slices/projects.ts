import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Project {
  id: string
  name: string
  brand: string
  category: string
  platform: string
  status: 'draft' | 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface ProjectsState {
  items: Project[]
  selectedId: string | null
  loading: boolean
  error: string | null
}

const initialState: ProjectsState = {
  items: [],
  selectedId: null,
  loading: false,
  error: null,
}

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action: PayloadAction<Project[]>) => {
      state.items = action.payload
    },
    selectProject: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload
    },
    setProjectsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setProjectsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
  selectors: {
    selectProjects: (state) => state.items,
    selectSelectedProjectId: (state) => state.selectedId,
    selectProjectsLoading: (state) => state.loading,
    selectProjectsError: (state) => state.error,
  },
})

export const { setProjects, selectProject, setProjectsLoading, setProjectsError } =
  projectsSlice.actions
export const {
  selectProjects,
  selectSelectedProjectId,
  selectProjectsLoading,
  selectProjectsError,
} = projectsSlice.selectors
