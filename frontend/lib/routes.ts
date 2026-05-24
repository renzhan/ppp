/**
 * Route constants, resolution utility, and collision validation
 * for the unified PPP + Presenton frontend.
 *
 * PPP routes use the "business" layout.
 * Presenton routes use the "editor" layout.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutType = 'business' | 'editor'
export type SourceProject = 'ppp' | 'presenton'

export interface RouteDefinition {
  path: string
  component: string
  layout: LayoutType
  source: SourceProject
  isDynamic: boolean
}

export interface ResolvedRoute {
  layout: LayoutType
  component: string
}

// ---------------------------------------------------------------------------
// Route Constants
// ---------------------------------------------------------------------------

/** PPP Business route paths */
export const PPP_ROUTES = {
  DASHBOARD: '/',
  PROJECTS: '/projects',
  PROJECT_DETAIL: '/projects/[id]',
  REVIEW: '/review/[id]',
  REVIEW_PPT: '/review/[id]/ppt',
  PLANNING: '/planning',
  SENTIMENT: '/sentiment',
  ADMIN: '/admin',
} as const

/** Presenton editor route paths */
export const PRESENTON_ROUTES = {
  GENERATOR: '/presentation',
  EDITOR: '/presentation/[id]',
  TEMPLATES: '/presentation/templates',
} as const

// ---------------------------------------------------------------------------
// Route Definitions
// ---------------------------------------------------------------------------

/**
 * Complete list of route definitions with metadata.
 * Each entry maps a path pattern to its component, layout, and source project.
 */
export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  // PPP Business Routes
  {
    path: PPP_ROUTES.DASHBOARD,
    component: 'DashboardPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: false,
  },
  {
    path: PPP_ROUTES.PROJECTS,
    component: 'ProjectListPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: false,
  },
  {
    path: PPP_ROUTES.PROJECT_DETAIL,
    component: 'ProjectDetailPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: true,
  },
  {
    path: PPP_ROUTES.REVIEW,
    component: 'ReviewReportPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: true,
  },
  {
    path: PPP_ROUTES.REVIEW_PPT,
    component: 'ReviewPptPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: true,
  },
  {
    path: PPP_ROUTES.PLANNING,
    component: 'PlanningPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: false,
  },
  {
    path: PPP_ROUTES.SENTIMENT,
    component: 'SentimentPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: false,
  },
  {
    path: PPP_ROUTES.ADMIN,
    component: 'AdminPage',
    layout: 'business',
    source: 'ppp',
    isDynamic: false,
  },

  // Presenton Editor Routes
  // Note: Static routes listed before dynamic to ensure correct matching order
  {
    path: PRESENTON_ROUTES.GENERATOR,
    component: 'PresentationGeneratorPage',
    layout: 'editor',
    source: 'presenton',
    isDynamic: false,
  },
  {
    path: PRESENTON_ROUTES.TEMPLATES,
    component: 'TemplateGalleryPage',
    layout: 'editor',
    source: 'presenton',
    isDynamic: false,
  },
  {
    path: PRESENTON_ROUTES.EDITOR,
    component: 'PresentationEditorPage',
    layout: 'editor',
    source: 'presenton',
    isDynamic: true,
  },
]

// ---------------------------------------------------------------------------
// Dynamic Route Helpers
// ---------------------------------------------------------------------------

/** Generate a project detail route */
export function projectRoute(id: string): string {
  return `/projects/${id}`
}

/** Generate a review report route */
export function reviewRoute(id: string): string {
  return `/review/${id}`
}

/** Generate a review PPT route */
export function reviewPptRoute(id: string): string {
  return `/review/${id}/ppt`
}

/** Generate a presentation editor route */
export function presentationRoute(id: string): string {
  return `/presentation/${id}`
}

// ---------------------------------------------------------------------------
// Route Resolution
// ---------------------------------------------------------------------------

/**
 * Converts a route pattern (with `[id]` segments) into a regex
 * that matches concrete paths.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars, then replace [id] with a named group
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const withParams = escaped.replace(/\\\[(\w+)\\\]/g, '([^/]+)')
  return new RegExp(`^${withParams}$`)
}

/**
 * Resolves a concrete path to its layout and component.
 * Returns `null` if no matching route is found.
 *
 * This implements the design doc's `resolveUnifiedRoute` logic:
 * - PPP routes map to the "business" layout
 * - Presenton routes (under /presentation) map to the "editor" layout
 */
export function resolveRoute(path: string): ResolvedRoute | null {
  for (const route of ROUTE_DEFINITIONS) {
    const regex = patternToRegex(route.path)
    if (regex.test(path)) {
      return { layout: route.layout, component: route.component }
    }
  }
  return null
}

/**
 * Determines how to map an original route from either project
 * into the unified frontend application.
 *
 * Follows the design doc's `resolveUnifiedRoute` algorithm:
 * - PPP routes map directly with "business" layout
 * - Presenton routes are namespaced under /presentation with "editor" layout
 */
export function resolveUnifiedRoute(
  originalRoute: string,
  sourceProject: SourceProject
): { path: string; layout: LayoutType } {
  if (sourceProject === 'ppp') {
    return { path: originalRoute, layout: 'business' }
  }

  if (sourceProject === 'presenton') {
    // Presenton routes get namespaced under /presentation
    const presentonRouteMap: Record<string, string> = {
      '/': '/presentation',
      '/presentation': '/presentation',
      '/presentation-templates': '/presentation/templates',
    }
    const mapped =
      presentonRouteMap[originalRoute] ?? `/presentation${originalRoute}`
    return { path: mapped, layout: 'editor' }
  }

  throw new Error(`Unknown source project: ${sourceProject}`)
}

// ---------------------------------------------------------------------------
// Route Collision Validation
// ---------------------------------------------------------------------------

/**
 * Extracts the top-level namespace from a route path.
 * E.g., "/projects/[id]" → "projects", "/presentation/[id]" → "presentation"
 * The root "/" returns "" (empty string).
 */
function getRouteNamespace(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments[0] ?? ''
}

/**
 * Validates that no route collisions exist between PPP and Presenton paths.
 * Returns an array of collision descriptions (empty if no collisions).
 *
 * A collision occurs when a PPP route and a Presenton route share the same
 * path pattern, meaning both would match the same concrete URL.
 */
export function validateNoCollisions(): string[] {
  const collisions: string[] = []

  const pppRoutes = ROUTE_DEFINITIONS.filter((r) => r.source === 'ppp')
  const presentonRoutes = ROUTE_DEFINITIONS.filter(
    (r) => r.source === 'presenton'
  )

  for (const pppRoute of pppRoutes) {
    for (const presRoute of presentonRoutes) {
      // Check if patterns are identical
      if (pppRoute.path === presRoute.path) {
        collisions.push(
          `Collision: PPP "${pppRoute.path}" and Presenton "${presRoute.path}" have identical patterns`
        )
        continue
      }

      // Check if one pattern could match the other's concrete paths
      const pppRegex = patternToRegex(pppRoute.path)
      const presRegex = patternToRegex(presRoute.path)

      // If a static route from one matches the pattern of the other
      if (!pppRoute.isDynamic && presRegex.test(pppRoute.path)) {
        collisions.push(
          `Collision: PPP static route "${pppRoute.path}" matches Presenton pattern "${presRoute.path}"`
        )
      }
      if (!presRoute.isDynamic && pppRegex.test(presRoute.path)) {
        collisions.push(
          `Collision: Presenton static route "${presRoute.path}" matches PPP pattern "${pppRoute.path}"`
        )
      }
    }
  }

  return collisions
}

/**
 * Returns the set of top-level namespaces used by each source project.
 * Useful for verifying namespace separation.
 */
export function getNamespacesBySource(): {
  ppp: Set<string>
  presenton: Set<string>
} {
  const ppp = new Set<string>()
  const presenton = new Set<string>()

  for (const route of ROUTE_DEFINITIONS) {
    const ns = getRouteNamespace(route.path)
    if (route.source === 'ppp') {
      ppp.add(ns)
    } else {
      presenton.add(ns)
    }
  }

  return { ppp, presenton }
}
