/**
 * Unit tests for the Review Report page component.
 * Validates: Requirements 1.1, 1.2
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock react's use() hook to resolve the params promise synchronously
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    use: (promise: unknown) => {
      // For our test, the promise is actually a plain object with { id }
      return promise
    },
  }
})

// Mock the layout component
vi.mock('@/components/layout', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}))

// Mock UI components
vi.mock('@/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  Button: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
}))

// Mock the API hooks
const mockUseReport = vi.fn()
const mockGenerateMutate = vi.fn()
const mockExportPdfMutate = vi.fn()
const mockExportWordMutate = vi.fn()

vi.mock('@/lib/ppp-api', () => ({
  useReport: (id: string) => mockUseReport(id),
  useGenerateReport: () => ({ mutate: mockGenerateMutate, isPending: false }),
  useExportPdf: () => ({ mutate: mockExportPdfMutate, isPending: false }),
  useExportWord: () => ({ mutate: mockExportWordMutate, isPending: false }),
}))

import ReviewReportPage from '@/app/review/[id]/page'

// Helper: pass a plain object that our mocked use() will return directly
function createMockParams(id: string) {
  return { id } as unknown as Promise<{ id: string }>
}

describe('ReviewReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the page heading', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    expect(screen.getByRole('heading', { name: 'Review Report' })).toBeInTheDocument()
  })

  it('shows export buttons', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    expect(screen.getByText('Export PDF')).toBeInTheDocument()
    expect(screen.getByText('Export Word')).toBeInTheDocument()
    expect(screen.getByText('Generate Report')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    expect(screen.getByText('Loading report...')).toBeInTheDocument()
  })

  it('shows empty state when no report exists', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    expect(screen.getByText(/No report generated yet/)).toBeInTheDocument()
  })

  it('renders report data when available', () => {
    const mockReport = {
      projectId: 'proj-123',
      modules: { M1: { status: 'show' }, M2: { status: 'show' } },
      metrics: {},
      narrative: {},
      generatedAt: '2024-06-15T10:30:00Z',
    }
    mockUseReport.mockReturnValue({ data: mockReport, isLoading: false, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    expect(screen.getByText('Report Summary')).toBeInTheDocument()
    expect(screen.getByText(/2 modules/)).toBeInTheDocument()
  })

  it('renders breadcrumb navigation', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    // Breadcrumb links - use getAllByText since "Projects" appears in breadcrumb
    const projectsLinks = screen.getAllByText('Projects')
    const breadcrumbLink = projectsLinks.find(el => el.closest('nav'))
    expect(breadcrumbLink).toBeInTheDocument()
    expect(breadcrumbLink!.closest('a')).toHaveAttribute('href', '/projects')
  })

  it('disables export buttons when no report is available', () => {
    mockUseReport.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    render(<ReviewReportPage params={createMockParams('proj-123')} />)

    const exportPdfBtn = screen.getByText('Export PDF')
    const exportWordBtn = screen.getByText('Export Word')
    expect(exportPdfBtn).toBeDisabled()
    expect(exportWordBtn).toBeDisabled()
  })
})
