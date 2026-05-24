/**
 * Unit tests for the Dashboard page component.
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
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}))

// Mock the store
const mockUseAppSelector = vi.fn()
vi.mock('@/store', () => ({
  useAppSelector: (selector: unknown) => mockUseAppSelector(selector),
}))

vi.mock('@/store/slices/auth', () => ({
  selectUser: 'selectUser',
}))

// Mock the API hooks
const mockUseProjects = vi.fn()
vi.mock('@/lib/ppp-api', () => ({
  useProjects: () => mockUseProjects(),
}))

import DashboardPage from '@/app/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the dashboard heading when no user is logged in', () => {
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({ data: [], isLoading: false })

    render(<DashboardPage />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders welcome message with user name when logged in', () => {
    mockUseAppSelector.mockReturnValue({ id: '1', email: 'test@test.com', name: 'Alice' })
    mockUseProjects.mockReturnValue({ data: [], isLoading: false })

    render(<DashboardPage />)

    expect(screen.getByText('Welcome back, Alice')).toBeInTheDocument()
  })

  it('shows loading state with dashes when projects are loading', () => {
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: true })

    render(<DashboardPage />)

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(4)
  })

  it('renders project stats when data is available', () => {
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({
      data: [
        { id: '1', name: 'Project A', brand: 'Brand A', category: 'Cat A', platform: 'Web', status: 'active', createdAt: '2024-01-01' },
        { id: '2', name: 'Project B', brand: 'Brand B', category: 'Cat B', platform: 'Mobile', status: 'completed', createdAt: '2024-01-02' },
        { id: '3', name: 'Project C', brand: 'Brand C', category: 'Cat C', platform: 'Web', status: 'draft', createdAt: '2024-01-03' },
        { id: '4', name: 'Project D', brand: 'Brand D', category: 'Cat D', platform: 'Web', status: 'active', createdAt: '2024-01-04' },
      ],
      isLoading: false,
    })

    render(<DashboardPage />)

    // Total Projects = 4
    expect(screen.getByText('4')).toBeInTheDocument()
    // Active = 2
    expect(screen.getByText('2')).toBeInTheDocument()
    // Completed = 1, Drafts = 1 (both show "1")
    const ones = screen.getAllByText('1')
    expect(ones.length).toBe(2)
  })

  it('renders quick action links', () => {
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({ data: [], isLoading: false })

    render(<DashboardPage />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Planning')).toBeInTheDocument()
    expect(screen.getByText('Sentiment')).toBeInTheDocument()
  })

  it('renders recent projects when data is available', () => {
    mockUseAppSelector.mockReturnValue(null)
    mockUseProjects.mockReturnValue({
      data: [
        { id: '1', name: 'Marketing Campaign', brand: 'Acme', category: 'Digital', platform: 'Web', status: 'active', createdAt: '2024-01-01' },
      ],
      isLoading: false,
    })

    render(<DashboardPage />)

    expect(screen.getByText('Marketing Campaign')).toBeInTheDocument()
    expect(screen.getByText('Acme · Digital')).toBeInTheDocument()
  })
})
