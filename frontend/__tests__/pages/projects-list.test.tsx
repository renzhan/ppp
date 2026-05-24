/**
 * Unit tests for the Projects List page component.
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
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
  Input: ({ placeholder, value, onChange }: { placeholder?: string; value?: string; onChange?: (e: unknown) => void }) => (
    <input placeholder={placeholder} value={value} onChange={onChange} />
  ),
}))

// Mock the API hooks
const mockUseProjects = vi.fn()
vi.mock('@/lib/ppp-api', () => ({
  useProjects: () => mockUseProjects(),
}))

import ProjectsListPage from '@/app/projects/page'

const mockProjects = [
  {
    id: '1',
    name: 'Campaign Alpha',
    brand: 'BrandX',
    category: 'Digital Marketing',
    platform: 'Instagram',
    status: 'active',
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2024-03-15T00:00:00Z',
  },
  {
    id: '2',
    name: 'Campaign Beta',
    brand: 'BrandY',
    category: 'Content',
    platform: 'YouTube',
    status: 'completed',
    createdAt: '2024-02-10T00:00:00Z',
    updatedAt: '2024-02-10T00:00:00Z',
  },
  {
    id: '3',
    name: 'Campaign Gamma',
    brand: 'BrandZ',
    category: 'Social',
    platform: 'TikTok',
    status: 'draft',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
  },
]

describe('ProjectsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false, isError: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the page heading', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false })

    render(<ProjectsListPage />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Manage all marketing review projects.')).toBeInTheDocument()
  })

  it('shows search input', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false })

    render(<ProjectsListPage />)

    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<ProjectsListPage />)

    expect(screen.getByText('Loading projects...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<ProjectsListPage />)

    expect(screen.getByText('Failed to load projects. Please try again.')).toBeInTheDocument()
  })

  it('renders project table with mock data', () => {
    mockUseProjects.mockReturnValue({ data: mockProjects, isLoading: false, isError: false })

    render(<ProjectsListPage />)

    // Table headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Platform')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()

    // Project data
    expect(screen.getByText('Campaign Alpha')).toBeInTheDocument()
    expect(screen.getByText('BrandX')).toBeInTheDocument()
    expect(screen.getByText('Digital Marketing')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()

    expect(screen.getByText('Campaign Beta')).toBeInTheDocument()
    expect(screen.getByText('BrandY')).toBeInTheDocument()

    expect(screen.getByText('Campaign Gamma')).toBeInTheDocument()
    expect(screen.getByText('BrandZ')).toBeInTheDocument()
  })

  it('shows New Project button', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false })

    render(<ProjectsListPage />)

    expect(screen.getByText('New Project')).toBeInTheDocument()
  })

  it('shows empty state when no projects exist', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false })

    render(<ProjectsListPage />)

    expect(screen.getByText('No projects yet.')).toBeInTheDocument()
  })
})
