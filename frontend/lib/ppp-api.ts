'use client'

/**
 * TanStack Query hooks for PPP backend endpoints.
 * Base URL configured via PPP_BACKEND_URL environment variable.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { fetchClient, ApiError } from './fetch-client'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PPP_BASE_URL = process.env.PPP_BACKEND_URL || 'http://localhost:4000'

function pppFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchClient<T>(path, { ...options, baseUrl: PPP_BASE_URL })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: { id: string; email: string; name: string }
}

export interface Project {
  id: string
  name: string
  brand: string
  category: string
  platform: string
  startDate: string
  endDate: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  brand: string
  category: string
  platform: string
  startDate: string
  endDate: string
}

export interface UpdateProjectRequest {
  name?: string
  brand?: string
  category?: string
  platform?: string
  startDate?: string
  endDate?: string
  status?: string
}

export interface ProjectDetail extends Project {
  modules?: Record<string, unknown>
  metrics?: Record<string, unknown>
}

export interface ReportData {
  projectId: string
  modules: Record<string, unknown>
  metrics: Record<string, unknown>
  narrative: Record<string, unknown>
  generatedAt: string
}

export interface PPTGenerateRequest {
  slideCount?: number
  language?: string
  template?: string
}

export interface PPTGenerateResponse {
  presentationId: string
  editUrl: string
  downloadUrl: string
}

export interface ExportResult {
  url: string
  filename: string
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const pppQueryKeys = {
  projects: ['ppp', 'projects'] as const,
  project: (id: string) => ['ppp', 'projects', id] as const,
  report: (projectId: string) => ['ppp', 'report', projectId] as const,
  ppt: (id: string) => ['ppp', 'ppt', id] as const,
}

// ---------------------------------------------------------------------------
// Auth Hooks
// ---------------------------------------------------------------------------

export function useLogin(
  options?: UseMutationOptions<AuthResponse, ApiError, LoginRequest>
) {
  return useMutation<AuthResponse, ApiError, LoginRequest>({
    mutationFn: (credentials) =>
      pppFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    ...options,
  })
}

export function useRefreshToken(
  options?: UseMutationOptions<AuthResponse, ApiError, string>
) {
  return useMutation<AuthResponse, ApiError, string>({
    mutationFn: (refreshToken) =>
      pppFetch<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
    ...options,
  })
}

// ---------------------------------------------------------------------------
// Project Hooks
// ---------------------------------------------------------------------------

export function useProjects(
  options?: Partial<UseQueryOptions<Project[], ApiError>>
) {
  return useQuery<Project[], ApiError>({
    queryKey: pppQueryKeys.projects,
    queryFn: () => pppFetch<Project[]>('/api/projects'),
    ...options,
  })
}

export function useProject(
  id: string,
  options?: Partial<UseQueryOptions<ProjectDetail, ApiError>>
) {
  return useQuery<ProjectDetail, ApiError>({
    queryKey: pppQueryKeys.project(id),
    queryFn: () => pppFetch<ProjectDetail>(`/api/projects/${id}`),
    enabled: !!id,
    ...options,
  })
}

export function useCreateProject(
  options?: UseMutationOptions<Project, ApiError, CreateProjectRequest>
) {
  const queryClient = useQueryClient()
  return useMutation<Project, ApiError, CreateProjectRequest>({
    mutationFn: (data) =>
      pppFetch<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pppQueryKeys.projects })
    },
    ...options,
  })
}

export function useUpdateProject(
  options?: UseMutationOptions<
    Project,
    ApiError,
    { id: string; data: UpdateProjectRequest }
  >
) {
  const queryClient = useQueryClient()
  return useMutation<
    Project,
    ApiError,
    { id: string; data: UpdateProjectRequest }
  >({
    mutationFn: ({ id, data }) =>
      pppFetch<Project>(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pppQueryKeys.projects })
      queryClient.invalidateQueries({ queryKey: pppQueryKeys.project(id) })
    },
    ...options,
  })
}

// ---------------------------------------------------------------------------
// Report Hooks
// ---------------------------------------------------------------------------

export function useReport(
  projectId: string,
  options?: Partial<UseQueryOptions<ReportData, ApiError>>
) {
  return useQuery<ReportData, ApiError>({
    queryKey: pppQueryKeys.report(projectId),
    queryFn: () =>
      pppFetch<ReportData>(`/api/projects/${projectId}/report`),
    enabled: !!projectId,
    ...options,
  })
}

export function useGenerateReport(
  options?: UseMutationOptions<ReportData, ApiError, string>
) {
  const queryClient = useQueryClient()
  return useMutation<ReportData, ApiError, string>({
    mutationFn: (projectId) =>
      pppFetch<ReportData>(`/api/projects/${projectId}/report/generate`, {
        method: 'POST',
      }),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: pppQueryKeys.report(projectId),
      })
    },
    ...options,
  })
}

// ---------------------------------------------------------------------------
// Export Hooks
// ---------------------------------------------------------------------------

export function useExportPdf(
  options?: UseMutationOptions<ExportResult, ApiError, string>
) {
  return useMutation<ExportResult, ApiError, string>({
    mutationFn: (projectId) =>
      pppFetch<ExportResult>(`/api/projects/${projectId}/export/pdf`, {
        method: 'POST',
      }),
    ...options,
  })
}

export function useExportWord(
  options?: UseMutationOptions<ExportResult, ApiError, string>
) {
  return useMutation<ExportResult, ApiError, string>({
    mutationFn: (projectId) =>
      pppFetch<ExportResult>(`/api/projects/${projectId}/export/word`, {
        method: 'POST',
      }),
    ...options,
  })
}

export function useExportPpt(
  options?: UseMutationOptions<
    PPTGenerateResponse,
    ApiError,
    { projectId: string; options?: PPTGenerateRequest }
  >
) {
  return useMutation<
    PPTGenerateResponse,
    ApiError,
    { projectId: string; options?: PPTGenerateRequest }
  >({
    mutationFn: ({ projectId, options: pptOptions }) =>
      pppFetch<PPTGenerateResponse>(
        `/api/projects/${projectId}/export/ppt`,
        {
          method: 'POST',
          body: JSON.stringify(pptOptions ?? {}),
        }
      ),
    ...options,
  })
}

// ---------------------------------------------------------------------------
// PPT Generation Hooks
// ---------------------------------------------------------------------------

export function useGeneratePpt(
  options?: UseMutationOptions<PPTGenerateResponse, ApiError, PPTGenerateRequest>
) {
  return useMutation<PPTGenerateResponse, ApiError, PPTGenerateRequest>({
    mutationFn: (request) =>
      pppFetch<PPTGenerateResponse>('/api/ppt/generate', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    ...options,
  })
}

export function usePptStatus(
  id: string,
  options?: Partial<UseQueryOptions<PPTGenerateResponse, ApiError>>
) {
  return useQuery<PPTGenerateResponse, ApiError>({
    queryKey: pppQueryKeys.ppt(id),
    queryFn: () => pppFetch<PPTGenerateResponse>(`/api/ppt/${id}`),
    enabled: !!id,
    ...options,
  })
}
