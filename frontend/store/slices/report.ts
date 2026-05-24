import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ModuleData {
  status: 'show' | 'hide'
  paragraphs: string[]
  tables: Record<string, string>[][]
}

export type ModuleKey = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8'

export interface ReportState {
  projectId: string | null
  modules: Partial<Record<ModuleKey, ModuleData>>
  generatedAt: string | null
  loading: boolean
}

const initialState: ReportState = {
  projectId: null,
  modules: {},
  generatedAt: null,
  loading: false,
}

export const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    setReportData: (
      state,
      action: PayloadAction<{
        projectId: string
        modules: ReportState['modules']
        generatedAt: string
      }>
    ) => {
      state.projectId = action.payload.projectId
      state.modules = action.payload.modules
      state.generatedAt = action.payload.generatedAt
    },
    setModuleVisibility: (
      state,
      action: PayloadAction<{ key: ModuleKey; status: 'show' | 'hide' }>
    ) => {
      const module = state.modules[action.payload.key]
      if (module) {
        module.status = action.payload.status
      }
    },
    setReportLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    clearReport: (state) => {
      state.projectId = null
      state.modules = {}
      state.generatedAt = null
    },
  },
  selectors: {
    selectReportProjectId: (state) => state.projectId,
    selectReportModules: (state) => state.modules,
    selectReportGeneratedAt: (state) => state.generatedAt,
    selectReportLoading: (state) => state.loading,
  },
})

export const { setReportData, setModuleVisibility, setReportLoading, clearReport } =
  reportSlice.actions
export const {
  selectReportProjectId,
  selectReportModules,
  selectReportGeneratedAt,
  selectReportLoading,
} = reportSlice.selectors
