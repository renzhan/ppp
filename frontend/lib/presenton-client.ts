/**
 * API client for Presenton backend.
 * Authenticates via X-API-Key header.
 * Base URL configured via PRESENTON_BACKEND_URL environment variable.
 */

import { fetchClient, ApiError } from './fetch-client'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRESENTON_BASE_URL =
  process.env.PRESENTON_BACKEND_URL || 'http://localhost:8000'
const PRESENTON_API_KEY = process.env.PRESENTON_API_KEY || ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresentationGenerateRequest {
  content: string
  n_slides?: number
  language?: string
  template?: string
  tone?: string
  verbosity?: string
  instructions?: string
  include_title_slide?: boolean
  export_as?: string
}

export interface PresentationResponse {
  presentation_id: string
  title: string
  path?: string
  slides?: SlideData[]
}

export interface SlideData {
  index: number
  type: string
  content: Record<string, unknown>
  layout: string
  notes?: string
}

export interface PresentationDetail {
  id: string
  title: string
  slides: SlideData[]
  theme: ThemeConfig
  template: string
  created_at: string
  updated_at: string
}

export interface ThemeConfig {
  primary_color: string
  secondary_color: string
  font_family: string
  background: string
}

export interface PresentationEditRequest {
  presentation_id: string
  slides: SlideData[]
  theme?: ThemeConfig
}

export interface ExportRequest {
  presentation_id: string
  format?: string
}

export interface ExportResponse {
  url: string
  filename: string
  path: string
}

export interface Template {
  id: string
  name: string
  description: string
  thumbnail: string
}

export interface Theme {
  id: string
  name: string
  config: ThemeConfig
}

export interface ImageGenerateRequest {
  prompt: string
  width?: number
  height?: number
}

export interface ImageResponse {
  url: string
  path: string
}

export interface IconResult {
  id: string
  name: string
  url: string
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function presentonHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (PRESENTON_API_KEY) {
    headers['X-API-Key'] = PRESENTON_API_KEY
  }
  return headers
}

function presentonFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchClient<T>(path, {
    ...options,
    baseUrl: PRESENTON_BASE_URL,
    headers: {
      ...presentonHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  })
}

// ---------------------------------------------------------------------------
// Presentation Endpoints
// ---------------------------------------------------------------------------

export async function generatePresentation(
  request: PresentationGenerateRequest
): Promise<PresentationResponse> {
  return presentonFetch<PresentationResponse>(
    '/api/v1/ppt/presentation/generate',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

export async function getPresentation(
  id: string
): Promise<PresentationDetail> {
  return presentonFetch<PresentationDetail>(
    `/api/v1/ppt/presentation/${id}`
  )
}

export async function editPresentation(
  request: PresentationEditRequest
): Promise<PresentationResponse> {
  return presentonFetch<PresentationResponse>(
    '/api/v1/ppt/presentation/edit',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

// ---------------------------------------------------------------------------
// Export Endpoints
// ---------------------------------------------------------------------------

export async function exportPptx(
  request: ExportRequest
): Promise<ExportResponse> {
  return presentonFetch<ExportResponse>(
    '/api/v1/ppt/presentation/export/pptx',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

export async function exportPdf(
  request: ExportRequest
): Promise<ExportResponse> {
  return presentonFetch<ExportResponse>(
    '/api/v1/ppt/presentation/export/pdf',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

// ---------------------------------------------------------------------------
// Resource Endpoints
// ---------------------------------------------------------------------------

export async function getTemplates(): Promise<Template[]> {
  return presentonFetch<Template[]>('/api/v1/ppt/presentation/templates')
}

export async function getThemes(): Promise<Theme[]> {
  return presentonFetch<Theme[]>('/api/v1/ppt/themes')
}

export async function generateImage(
  request: ImageGenerateRequest
): Promise<ImageResponse> {
  return presentonFetch<ImageResponse>('/api/v1/ppt/images/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function searchIcons(query: string): Promise<IconResult[]> {
  return presentonFetch<IconResult[]>(
    `/api/v1/ppt/icons/search?q=${encodeURIComponent(query)}`
  )
}

// ---------------------------------------------------------------------------
// Re-export error type for consumers
// ---------------------------------------------------------------------------

export { ApiError }
