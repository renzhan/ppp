# Implementation Plan: Project Merge Restructure (Presenton + PPP_PI_New)

## Overview

This plan merges two codebases into a unified platform with a monorepo structure: a unified Next.js 16 frontend, a PPP Node.js/TypeScript backend, and a standalone Presenton FastAPI backend, orchestrated via Docker Compose with Nginx reverse proxy. Implementation follows 4 phases: Repository Restructure → Frontend Merge → Backend Extraction → Integration & Deployment.

## Tasks

- [x] 1. Phase 1: Repository Restructure
  - [x] 1.1 Create monorepo directory structure
    - Create top-level directories: `frontend/`, `backend/`, `presenton/`
    - Add root-level `docker-compose.yml`, `nginx.conf`, and `.env.example` placeholder files
    - Create root `README.md` documenting the monorepo structure
    - _Requirements: 11.1, 11.5_

  - [x] 1.2 Migrate PPP backend code to `backend/` directory
    - Move `ppp_pi_new/src/` to `backend/src/`
    - Move `ppp_pi_new/prisma/` to `backend/prisma/`
    - Move `ppp_pi_new/prisma.config.ts` to `backend/prisma.config.ts`
    - Create `backend/package.json` with PPP backend dependencies (Prisma, jose, OpenAI SDK, docx, xlsx)
    - Create `backend/tsconfig.json` for the backend service
    - Verify existing PPP backend source compiles in new location
    - _Requirements: 11.3, 9.1, 9.3_

  - [x] 1.3 Extract Presenton FastAPI backend to `presenton/` directory
    - Copy Presenton's `api/`, `services/`, `models/` directories to `presenton/`
    - Copy `pyproject.toml` or `requirements.txt` to `presenton/`
    - Copy Alembic migration files and configuration
    - Remove all Electron-specific code and desktop dependencies from the extracted code
    - Verify Presenton backend structure is self-contained
    - _Requirements: 11.4, 5.1, 1.6_

  - [x] 1.4 Initialize unified frontend in `frontend/` directory
    - Create `frontend/` with Next.js 16 + React 19 project scaffold
    - Configure `frontend/package.json` with dependencies: Next.js 16.2.6, React 19.2.6, Redux Toolkit, TanStack Query, Radix UI, Tailwind CSS, Zod
    - Set up `frontend/tsconfig.json` and `frontend/next.config.ts`
    - Create `frontend/app/` directory with root layout
    - Create `frontend/components/`, `frontend/lib/`, `frontend/store/` directories
    - _Requirements: 11.2, 1.1_

- [x] 2. Checkpoint - Verify repository structure
  - Ensure all three service directories exist with valid configuration files
  - Verify `backend/` compiles with `tsc --noEmit`
  - Verify `presenton/` has valid Python package structure
  - Verify `frontend/` builds with `next build`
  - Ask the user if questions arise.

- [x] 3. Phase 2: Frontend Merge - Core Setup
  - [x] 3.1 Set up unified Redux store with namespace isolation
    - Create `frontend/store/index.ts` with `configureStore` using `combineSlices`
    - Create PPP state slices: `frontend/store/slices/auth.ts`, `frontend/store/slices/projects.ts`, `frontend/store/slices/report.ts`
    - Create Presenton state slices under `presentation` namespace: `frontend/store/slices/presentation.ts`, `frontend/store/slices/editor.ts`, `frontend/store/slices/theme.ts`
    - Ensure all Presenton slices are prefixed with `presentation` key
    - Create `frontend/store/provider.tsx` wrapping the app with Redux Provider
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.2 Write property test for Redux state namespace isolation
    - **Property 11: Redux State Namespace Isolation**
    - Verify all Presenton-originated state slice keys are prefixed with `presentation`
    - Verify no key collisions between PPP and Presenton state slices
    - Use fast-check to generate arbitrary slice names and verify isolation
    - **Validates: Requirement 10.1**

  - [x] 3.3 Set up API client libraries
    - Create `frontend/lib/ppp-api.ts` - TanStack Query hooks for PPP backend endpoints
    - Create `frontend/lib/presenton-client.ts` - API client for Presenton backend (with X-API-Key header)
    - Configure base URLs from environment variables (`PPP_BACKEND_URL`, `PRESENTON_BACKEND_URL`)
    - _Requirements: 6.3, 13.3_

  - [x] 3.4 Create shared component library
    - Port shared UI primitives from Presenton (buttons, inputs, modals, cards) to `frontend/components/ui/`
    - Use Radix UI as the base for accessible component primitives
    - Set up Tailwind CSS configuration with design tokens from both projects
    - Create `frontend/components/layout/` with app shell, navigation, and sidebar components
    - _Requirements: 1.1, 1.4_

- [x] 4. Phase 2: Frontend Merge - Page Migration
  - [x] 4.1 Port PPP business pages to unified frontend
    - Migrate dashboard page to `frontend/app/page.tsx`
    - Migrate projects list to `frontend/app/projects/page.tsx`
    - Migrate project detail to `frontend/app/projects/[id]/page.tsx`
    - Migrate review report to `frontend/app/review/[id]/page.tsx`
    - Migrate planning page to `frontend/app/planning/page.tsx`
    - Migrate sentiment page to `frontend/app/sentiment/page.tsx`
    - Migrate admin page to `frontend/app/admin/page.tsx`
    - Update all imports to use new shared components and API clients
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Port Presenton editor pages to unified frontend
    - Migrate presentation generator to `frontend/app/presentation/page.tsx`
    - Migrate presentation editor to `frontend/app/presentation/[id]/page.tsx`
    - Migrate template gallery to `frontend/app/presentation/templates/page.tsx`
    - Add PPT generation page at `frontend/app/review/[id]/ppt/page.tsx`
    - Port TipTap rich text editor integration for slide editing
    - Implement lazy loading for Presenton editor components (code-splitting)
    - _Requirements: 1.1, 1.3, 1.4, 12.1_

  - [x] 4.3 Implement frontend route resolution logic
    - Create `frontend/lib/routes.ts` with route constants and resolution utility
    - Ensure PPP routes (`/projects`, `/review/:id`) map to business layout
    - Ensure Presenton routes (`/presentation`, `/presentation/:id`) map to editor layout
    - Verify no route collisions between PPP and Presenton paths
    - _Requirements: 1.2, 1.3_

  - [x] 4.4 Write property test for frontend route resolution
    - **Property 13: Frontend Route Resolution**
    - Use fast-check to generate valid routes from both PPP and Presenton
    - Verify each route resolves to exactly one page component
    - Verify no collisions between PPP and Presenton route namespaces
    - **Validates: Requirements 1.2, 1.3**

  - [x] 4.5 Write unit tests for PPP page components
    - Test dashboard, projects list, and review pages render correctly with mock data
    - Use Vitest + React Testing Library
    - _Requirements: 1.1, 1.2_

- [x] 5. Checkpoint - Verify frontend merge
  - Ensure `frontend/` builds successfully with `next build`
  - Ensure all routes resolve without 404 errors
  - Ensure Redux store initializes with correct namespace structure
  - Ask the user if questions arise.

- [x] 6. Phase 3: Backend Extraction - PPP Backend Services
  - [x] 6.1 Implement JWT authentication middleware
    - Create `backend/src/middleware/auth.ts` using `jose` library for JWT verification
    - Implement token validation that returns HTTP 401 for missing/invalid tokens
    - Create `backend/src/routes/auth.ts` with login and refresh endpoints
    - Apply auth middleware to all API routes
    - _Requirements: 6.1, 6.5_

  - [x] 6.2 Write property test for JWT authentication enforcement
    - **Property 6: JWT Authentication Enforcement**
    - Use fast-check to generate arbitrary request payloads and endpoints
    - Verify all requests without valid JWT receive HTTP 401
    - **Validates: Requirements 6.1, 6.5**

  - [x] 6.3 Implement project name validation
    - Create `backend/src/validators/project.ts` with Zod schema for project validation
    - Validate project name is non-empty and max 200 characters
    - Return appropriate error responses for invalid names
    - _Requirements: 3.6_

  - [x] 6.4 Write property test for project name validation
    - **Property 5: Project Name Validation**
    - Use fast-check to generate arbitrary strings (empty, boundary lengths, unicode)
    - Verify empty strings and strings > 200 chars are rejected
    - Verify valid strings (1-200 chars) are accepted
    - Verify deterministic results for same input
    - **Validates: Requirement 3.6**

  - [x] 6.5 Implement Presenton client with retry and circuit breaker
    - Create `backend/src/lib/presenton-client.ts` with `PresentonClient` class
    - Implement API key authentication via `X-API-Key` header from environment variable
    - Implement retry with exponential backoff (max 3 attempts) for failed calls
    - Implement health check polling (every 30 seconds)
    - Return HTTP 503 for PPT endpoints when Presenton is unavailable
    - Return normal responses for non-PPT endpoints regardless of Presenton status
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 13.3_

  - [x] 6.6 Write property test for service degradation isolation
    - **Property 8: Service Degradation Isolation**
    - Use fast-check to generate arbitrary request paths and payloads
    - Mock Presenton as unavailable
    - Verify PPT-related endpoints return HTTP 503
    - Verify non-PPT endpoints succeed normally
    - **Validates: Requirements 7.1, 7.2**

  - [x] 6.7 Write property test for retry with exponential backoff
    - **Property 9: Retry with Exponential Backoff**
    - Use fast-check to generate failure scenarios
    - Verify exactly 3 retry attempts with increasing delays
    - Verify error returned to client after all retries exhausted
    - **Validates: Requirement 7.3**

  - [x] 6.8 Implement PPT orchestration layer
    - Create `backend/src/services/ppt-orchestration.ts` with `orchestratePPTGeneration` function
    - Implement `assemblePrestonContent()` that extracts "show" modules and formats as markdown
    - Implement async generation: return job ID immediately, client polls for completion
    - Map Presenton response to edit URL (`/presentation/{id}`) and download URL
    - Ensure source report data is not mutated during assembly
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3_

  - [x] 6.9 Write property test for content assembly completeness
    - **Property 2: Content Assembly Completeness**
    - Use fast-check to generate report data with random module show/hide combinations
    - Verify output is non-empty and includes project metadata
    - Verify exactly the "show" modules appear in output
    - Verify tables are formatted as valid markdown
    - **Validates: Requirements 4.2, 4.4**

  - [x] 6.10 Write property test for content assembly immutability
    - **Property 3: Content Assembly Immutability**
    - Use fast-check to generate arbitrary report data objects
    - Deep-clone input before assembly, compare after assembly
    - Verify original report data is byte-for-byte identical after assembly
    - **Validates: Requirement 4.5**

  - [x] 6.11 Write property test for orchestration response mapping
    - **Property 4: Orchestration Response Mapping**
    - Use fast-check to generate Presenton response objects with random IDs and paths
    - Verify result contains valid presentation ID
    - Verify edit URL matches `/presentation/{id}` pattern
    - Verify download URL is derived from file path
    - **Validates: Requirement 4.3**

  - [x] 6.12 Write property test for async PPT generation response
    - **Property 12: Async PPT Generation Response**
    - Use fast-check to generate PPT generation requests
    - Verify response returns immediately with job ID
    - Verify response time does not correlate with generation duration
    - **Validates: Requirement 12.3**

- [x] 7. Phase 3: Backend Extraction - Presenton Backend
  - [x] 7.1 Add API key authentication to Presenton FastAPI
    - Create `presenton/api/middleware/auth.py` with API key validation middleware
    - Read expected API key from `PRESENTON_API_KEY` environment variable
    - Validate `X-API-Key` header on all incoming requests
    - Return HTTP 401 for requests missing or having invalid API key
    - Allow requests from internal Docker network without API key (optional fallback)
    - _Requirements: 6.2, 6.6, 13.4_

  - [x] 7.2 Write property test for API key authentication enforcement (Python)
    - **Property 7: API Key Authentication Enforcement**
    - Use Hypothesis to generate arbitrary request payloads and endpoints
    - Verify all requests without valid X-API-Key receive HTTP 401
    - **Validates: Requirements 6.2, 6.6, 13.4**

  - [x] 7.3 Create Presenton Dockerfile for standalone deployment
    - Create `presenton/Dockerfile` based on Python 3.11 slim image
    - Install dependencies from `pyproject.toml` or `requirements.txt`
    - Configure Uvicorn to serve on port 8000
    - Set up volume mount point for `/app_data` (file storage)
    - Remove any Electron IPC or desktop-specific startup code
    - _Requirements: 5.1, 5.4, 1.6_

  - [x] 7.4 Add health check endpoint to Presenton backend
    - Create `GET /api/v1/health` endpoint returning service status
    - Include database connectivity check and basic readiness probe
    - _Requirements: 7.5_

- [x] 8. Checkpoint - Verify backend services
  - Ensure `backend/` compiles and passes lint checks
  - Ensure Presenton backend starts with `uvicorn` and responds to health check
  - Ensure PPP backend auth middleware correctly rejects unauthenticated requests
  - Ask the user if questions arise.

- [x] 9. Phase 4: Integration & Deployment
  - [x] 9.1 Create Nginx reverse proxy configuration
    - Write `nginx.conf` with upstream definitions for frontend (3000), ppp-backend (4000), presenton-backend (8000)
    - Configure `/api/v1/` → presenton-backend with 30-minute read timeout
    - Configure `/api/` → ppp-backend with 60-second read timeout
    - Configure `/app_data/` → presenton-backend with 1-year cache expiry
    - Configure `/` → frontend with WebSocket upgrade headers
    - Add CORS headers handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 13.1_

  - [x] 9.2 Write property test for request routing correctness
    - **Property 1: Request Routing Correctness**
    - Use fast-check to generate arbitrary HTTP request paths
    - Verify `/api/v1/*` routes to Presenton (port 8000)
    - Verify `/api/*` (non-v1) routes to PPP backend (port 4000)
    - Verify `/app_data/*` routes to Presenton
    - Verify all other paths route to frontend (port 3000)
    - Verify each request routes to exactly one service
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 9.3 Create Docker Compose orchestration
    - Write `docker-compose.yml` with services: nginx, frontend, ppp-backend, presenton-backend, db (PostgreSQL 16)
    - Configure service dependencies (db → ppp-backend → nginx, presenton-backend → nginx)
    - Configure named volumes for PostgreSQL data and Presenton file storage
    - Expose only port 80 (Nginx) to host; all other services on internal network only
    - Pass all configuration via environment variables with `.env` file
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 9.4 Create frontend Dockerfile
    - Write `frontend/Dockerfile` for Next.js 16 production build
    - Multi-stage build: install deps → build → production image
    - Configure to serve on port 3000
    - Pass backend URLs as build-time and runtime environment variables
    - _Requirements: 8.1_

  - [x] 9.5 Create PPP backend Dockerfile
    - Write `backend/Dockerfile` for Node.js 20 LTS
    - Multi-stage build: install deps → build TypeScript → production image
    - Run Prisma generate as part of build
    - Configure to serve on port 4000
    - _Requirements: 8.1_

  - [x] 9.6 Create environment configuration
    - Create root `.env.example` with all required environment variables documented
    - Include: DATABASE_URL, PRESENTON_API_URL, PRESENTON_API_KEY, JWT_SECRET, LLM provider keys
    - Ensure no secrets are committed to source control (add `.env` to `.gitignore`)
    - _Requirements: 8.5, 13.2_

  - [x] 9.7 Write integration tests for service communication
    - Test PPP backend can reach Presenton backend via internal network
    - Test Nginx routes requests to correct upstream services
    - Test end-to-end flow: authenticate → create project → generate PPT
    - Use Docker Compose test environment
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1_

- [x] 10. Phase 4: Data Migration Verification
  - [x] 10.1 Create data migration verification scripts
    - Write `scripts/verify-ppp-data.ts` that compares PPP project records before/after migration
    - Write `scripts/verify-presenton-data.py` that compares Presenton presentation records before/after migration
    - Ensure both scripts confirm byte-for-byte data preservation
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 10.2 Write property test for data preservation during migration
    - **Property 10: Data Preservation During Migration**
    - Use fast-check to generate sample project records and presentation records
    - Run migration process on generated data
    - Verify records are identical before and after migration
    - **Validates: Requirements 9.1, 9.2**

- [x] 11. Final Checkpoint - Full system verification
  - Ensure `docker-compose up` starts all services successfully
  - Ensure Nginx routes requests correctly to all three services
  - Ensure frontend loads and renders both PPP and Presenton pages
  - Ensure PPP backend authenticates and serves project data
  - Ensure Presenton backend responds to API calls with valid API key
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between phases
- Property tests use fast-check (TypeScript) and Hypothesis (Python) as specified in the design
- The frontend uses TypeScript throughout; the Presenton backend uses Python
- Data migration preserves existing databases without cross-database dependencies
