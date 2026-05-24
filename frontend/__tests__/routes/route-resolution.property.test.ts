import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  resolveRoute,
  validateNoCollisions,
  getNamespacesBySource,
  ROUTE_DEFINITIONS,
  PPP_ROUTES,
  PRESENTON_ROUTES,
  projectRoute,
  reviewRoute,
  presentationRoute,
} from '../../lib/routes'

/**
 * Property 13: Frontend Route Resolution
 *
 * *For any* valid route from the original PPP application or the original
 * Presenton web UI, the Unified_Frontend's router SHALL resolve it to the
 * correct page component without collisions between PPP and Presenton routes.
 *
 * **Validates: Requirements 1.2, 1.3**
 */
describe('Property 13: Frontend Route Resolution', () => {
  // Arbitrary valid ID generator (alphanumeric, UUID-like strings)
  const validIdArb = fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')
      ),
      { minLength: 1, maxLength: 36 }
    )
    .map((chars) => chars.join(''))

  it('should resolve all dynamic PPP routes with arbitrary valid IDs', () => {
    fc.assert(
      fc.property(validIdArb, (id: string) => {
        // Project detail route
        const projectResult = resolveRoute(projectRoute(id))
        expect(projectResult).not.toBeNull()
        expect(projectResult!.component).toBe('ProjectDetailPage')
        expect(projectResult!.layout).toBe('business')

        // Review route
        const reviewResult = resolveRoute(reviewRoute(id))
        expect(reviewResult).not.toBeNull()
        expect(reviewResult!.component).toBe('ReviewReportPage')
        expect(reviewResult!.layout).toBe('business')
      }),
      { numRuns: 200 }
    )
  })

  it('should resolve all dynamic Presenton routes with arbitrary valid IDs', () => {
    fc.assert(
      fc.property(validIdArb, (id: string) => {
        const result = resolveRoute(presentationRoute(id))
        expect(result).not.toBeNull()
        expect(result!.component).toBe('PresentationEditorPage')
        expect(result!.layout).toBe('editor')
      }),
      { numRuns: 200 }
    )
  })

  it('should resolve all PPP routes to the "business" layout', () => {
    const pppPaths = Object.values(PPP_ROUTES)

    for (const routePath of pppPaths) {
      // Replace [id] with a concrete value for dynamic routes
      const concretePath = routePath.replace(/\[id\]/g, 'test-id-123')
      const result = resolveRoute(concretePath)
      expect(result).not.toBeNull()
      expect(result!.layout).toBe('business')
    }
  })

  it('should resolve all Presenton routes to the "editor" layout', () => {
    const presentonPaths = Object.values(PRESENTON_ROUTES)

    for (const routePath of presentonPaths) {
      // Replace [id] with a concrete value for dynamic routes
      const concretePath = routePath.replace(/\[id\]/g, 'test-id-456')
      const result = resolveRoute(concretePath)
      expect(result).not.toBeNull()
      expect(result!.layout).toBe('editor')
    }
  })

  it('should never resolve a generated route to more than one component (property-based)', () => {
    fc.assert(
      fc.property(validIdArb, (id: string) => {
        // Generate all possible concrete routes with the arbitrary ID
        const concreteRoutes = [
          projectRoute(id),
          reviewRoute(id),
          `/review/${id}/ppt`,
          presentationRoute(id),
        ]

        for (const path of concreteRoutes) {
          // Count how many route definitions match this path
          const matches = ROUTE_DEFINITIONS.filter((route) => {
            const escaped = route.path.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            )
            const withParams = escaped.replace(/\\\[(\w+)\\\]/g, '([^/]+)')
            const regex = new RegExp(`^${withParams}$`)
            return regex.test(path)
          })

          // Each concrete route should match at most one definition
          expect(matches.length).toBeLessThanOrEqual(1)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('should have no collisions between PPP and Presenton route namespaces', () => {
    const { ppp, presenton } = getNamespacesBySource()

    // Check that no namespace appears in both sets
    // Exception: root namespace "" (empty string) is allowed for PPP dashboard
    for (const ns of ppp) {
      if (ns === '') continue // Root path is PPP-only (dashboard)
      expect(presenton.has(ns)).toBe(false)
    }

    for (const ns of presenton) {
      if (ns === '') continue
      expect(ppp.has(ns)).toBe(false)
    }
  })

  it('should report no collisions via validateNoCollisions()', () => {
    const collisions = validateNoCollisions()
    expect(collisions).toEqual([])
  })

  it('should resolve arbitrary path strings to either exactly one route or null (property-based)', () => {
    // Generate arbitrary path-like strings
    const pathSegmentArb = fc
      .array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')
        ),
        { minLength: 1, maxLength: 20 }
      )
      .map((chars) => chars.join(''))

    const arbitraryPathArb = fc.array(pathSegmentArb, { minLength: 0, maxLength: 4 }).map(
      (segments) => '/' + segments.join('/')
    )

    fc.assert(
      fc.property(arbitraryPathArb, (path: string) => {
        const result = resolveRoute(path)

        // Result is either null (no match) or a valid resolved route
        if (result !== null) {
          expect(result.layout).toMatch(/^(business|editor)$/)
          expect(result.component).toBeTruthy()
          expect(typeof result.component).toBe('string')
        }

        // Verify at most one route definition matches this path
        const matches = ROUTE_DEFINITIONS.filter((route) => {
          const escaped = route.path.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )
          const withParams = escaped.replace(/\\\[(\w+)\\\]/g, '([^/]+)')
          const regex = new RegExp(`^${withParams}$`)
          return regex.test(path)
        })

        // Should never match more than one route definition
        expect(matches.length).toBeLessThanOrEqual(1)

        // If resolveRoute returned non-null, there should be exactly one match
        if (result !== null) {
          expect(matches.length).toBe(1)
        }
      }),
      { numRuns: 500 }
    )
  })
})
