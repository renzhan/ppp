import { describe, it, expect } from 'vitest'
import {
  PPP_ROUTES,
  PRESENTON_ROUTES,
  ROUTE_DEFINITIONS,
  resolveRoute,
  resolveUnifiedRoute,
  validateNoCollisions,
  getNamespacesBySource,
  projectRoute,
  reviewRoute,
  reviewPptRoute,
  presentationRoute,
} from './routes'

describe('Route Constants', () => {
  it('should define all PPP routes', () => {
    expect(PPP_ROUTES.DASHBOARD).toBe('/')
    expect(PPP_ROUTES.PROJECTS).toBe('/projects')
    expect(PPP_ROUTES.PROJECT_DETAIL).toBe('/projects/[id]')
    expect(PPP_ROUTES.REVIEW).toBe('/review/[id]')
    expect(PPP_ROUTES.REVIEW_PPT).toBe('/review/[id]/ppt')
    expect(PPP_ROUTES.PLANNING).toBe('/planning')
    expect(PPP_ROUTES.SENTIMENT).toBe('/sentiment')
    expect(PPP_ROUTES.ADMIN).toBe('/admin')
  })

  it('should define all Presenton routes', () => {
    expect(PRESENTON_ROUTES.GENERATOR).toBe('/presentation')
    expect(PRESENTON_ROUTES.EDITOR).toBe('/presentation/[id]')
    expect(PRESENTON_ROUTES.TEMPLATES).toBe('/presentation/templates')
  })
})

describe('ROUTE_DEFINITIONS', () => {
  it('should contain all 11 routes', () => {
    expect(ROUTE_DEFINITIONS).toHaveLength(11)
  })

  it('should have 8 PPP routes and 3 Presenton routes', () => {
    const ppp = ROUTE_DEFINITIONS.filter((r) => r.source === 'ppp')
    const presenton = ROUTE_DEFINITIONS.filter((r) => r.source === 'presenton')
    expect(ppp).toHaveLength(8)
    expect(presenton).toHaveLength(3)
  })

  it('should assign business layout to all PPP routes', () => {
    const ppp = ROUTE_DEFINITIONS.filter((r) => r.source === 'ppp')
    for (const route of ppp) {
      expect(route.layout).toBe('business')
    }
  })

  it('should assign editor layout to all Presenton routes', () => {
    const presenton = ROUTE_DEFINITIONS.filter((r) => r.source === 'presenton')
    for (const route of presenton) {
      expect(route.layout).toBe('editor')
    }
  })
})

describe('resolveRoute', () => {
  it('should resolve PPP static routes to business layout', () => {
    expect(resolveRoute('/')).toEqual({ layout: 'business', component: 'DashboardPage' })
    expect(resolveRoute('/projects')).toEqual({ layout: 'business', component: 'ProjectListPage' })
    expect(resolveRoute('/planning')).toEqual({ layout: 'business', component: 'PlanningPage' })
    expect(resolveRoute('/sentiment')).toEqual({ layout: 'business', component: 'SentimentPage' })
    expect(resolveRoute('/admin')).toEqual({ layout: 'business', component: 'AdminPage' })
  })

  it('should resolve PPP dynamic routes to business layout', () => {
    expect(resolveRoute('/projects/abc-123')).toEqual({ layout: 'business', component: 'ProjectDetailPage' })
    expect(resolveRoute('/review/proj-456')).toEqual({ layout: 'business', component: 'ReviewReportPage' })
    expect(resolveRoute('/review/proj-456/ppt')).toEqual({ layout: 'business', component: 'ReviewPptPage' })
  })

  it('should resolve Presenton static routes to editor layout', () => {
    expect(resolveRoute('/presentation')).toEqual({ layout: 'editor', component: 'PresentationGeneratorPage' })
    expect(resolveRoute('/presentation/templates')).toEqual({ layout: 'editor', component: 'TemplateGalleryPage' })
  })

  it('should resolve Presenton dynamic routes to editor layout', () => {
    expect(resolveRoute('/presentation/pres-789')).toEqual({ layout: 'editor', component: 'PresentationEditorPage' })
  })

  it('should return null for unknown routes', () => {
    expect(resolveRoute('/unknown')).toBeNull()
    expect(resolveRoute('/foo/bar/baz')).toBeNull()
  })
})

describe('resolveUnifiedRoute', () => {
  it('should map PPP routes directly with business layout', () => {
    expect(resolveUnifiedRoute('/projects', 'ppp')).toEqual({ path: '/projects', layout: 'business' })
    expect(resolveUnifiedRoute('/review/123', 'ppp')).toEqual({ path: '/review/123', layout: 'business' })
    expect(resolveUnifiedRoute('/', 'ppp')).toEqual({ path: '/', layout: 'business' })
  })

  it('should namespace Presenton routes under /presentation with editor layout', () => {
    expect(resolveUnifiedRoute('/', 'presenton')).toEqual({ path: '/presentation', layout: 'editor' })
    expect(resolveUnifiedRoute('/presentation', 'presenton')).toEqual({ path: '/presentation', layout: 'editor' })
    expect(resolveUnifiedRoute('/presentation-templates', 'presenton')).toEqual({ path: '/presentation/templates', layout: 'editor' })
  })

  it('should throw for unknown source project', () => {
    expect(() => resolveUnifiedRoute('/foo', 'unknown' as never)).toThrow('Unknown source project')
  })
})

describe('Dynamic Route Helpers', () => {
  it('should generate correct project route', () => {
    expect(projectRoute('abc-123')).toBe('/projects/abc-123')
  })

  it('should generate correct review route', () => {
    expect(reviewRoute('proj-456')).toBe('/review/proj-456')
  })

  it('should generate correct review PPT route', () => {
    expect(reviewPptRoute('proj-456')).toBe('/review/proj-456/ppt')
  })

  it('should generate correct presentation route', () => {
    expect(presentationRoute('pres-789')).toBe('/presentation/pres-789')
  })
})

describe('validateNoCollisions', () => {
  it('should report no collisions between PPP and Presenton routes', () => {
    const collisions = validateNoCollisions()
    expect(collisions).toEqual([])
  })
})

describe('getNamespacesBySource', () => {
  it('should return separate namespaces for PPP and Presenton', () => {
    const { ppp, presenton } = getNamespacesBySource()

    // PPP uses: "" (root), "projects", "review", "planning", "sentiment", "admin"
    expect(ppp.has('')).toBe(true)
    expect(ppp.has('projects')).toBe(true)
    expect(ppp.has('review')).toBe(true)
    expect(ppp.has('planning')).toBe(true)
    expect(ppp.has('sentiment')).toBe(true)
    expect(ppp.has('admin')).toBe(true)

    // Presenton uses only: "presentation"
    expect(presenton.has('presentation')).toBe(true)
    expect(presenton.size).toBe(1)
  })

  it('should have no overlapping namespaces between PPP and Presenton (except root is PPP only)', () => {
    const { ppp, presenton } = getNamespacesBySource()

    // No Presenton namespace should appear in PPP namespaces
    for (const ns of presenton) {
      expect(ppp.has(ns)).toBe(false)
    }
  })
})
