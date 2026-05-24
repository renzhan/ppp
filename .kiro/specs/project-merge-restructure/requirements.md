# Requirements Document

## Introduction

This document defines the requirements for merging two projects — Presenton (AI presentation generator) and PPP_PI_New (marketing review/report system) — into a unified platform. The merged system provides a single Next.js 16 frontend, an independent Python FastAPI backend for AI/PPT generation, a preserved Node.js/TypeScript backend for business logic, and Docker Compose orchestration with Nginx reverse proxy.

## Glossary

- **Unified_Frontend**: The merged Next.js 16 + React 19 web application serving both PPP business pages and Presenton editor functionality
- **PPP_Backend**: The Node.js/TypeScript backend service handling project management, data calculation, report generation, and export
- **Presenton_Backend**: The Python FastAPI microservice providing AI-powered presentation generation, editing, and export
- **Nginx_Proxy**: The Nginx reverse proxy that routes incoming requests to the appropriate backend service
- **Docker_Orchestrator**: The Docker Compose configuration managing all service containers
- **PPT_Orchestration_Layer**: The component within PPP_Backend that assembles report content and delegates presentation generation to Presenton_Backend
- **Redux_Store**: The unified client-side state management store combining PPP and Presenton state slices
- **Service_Mesh**: The internal Docker network enabling service-to-service communication without external exposure

## Requirements

### Requirement 1: Unified Frontend Application

**User Story:** As a user, I want a single web application for both marketing review and presentation editing, so that I can access all features without switching between separate applications.

#### Acceptance Criteria

1. THE Unified_Frontend SHALL serve all PPP business pages (dashboard, projects, review, planning, sentiment, admin) and all Presenton pages (presentation generator, editor, template gallery) from a single Next.js 16 application
2. WHEN a user navigates to a PPP route (e.g., `/projects`, `/review/:id`) THEN the Unified_Frontend SHALL render the corresponding PPP business page with full functionality
3. WHEN a user navigates to a Presenton route (e.g., `/presentation`, `/presentation/:id`) THEN the Unified_Frontend SHALL render the corresponding presentation page with full editor functionality
4. THE Unified_Frontend SHALL embed the presentation editor as a native module within the application, not as an iframe
5. THE Unified_Frontend SHALL manage client-side state via Redux Toolkit with namespaced slices for PPP state and Presenton state
6. WHEN the Unified_Frontend loads THEN the Unified_Frontend SHALL not include any Electron-specific code or desktop dependencies

### Requirement 2: Request Routing

**User Story:** As a system operator, I want all incoming requests routed to the correct backend service, so that each service handles only its designated traffic.

#### Acceptance Criteria

1. WHEN a request path starts with `/api/v1/` THEN the Nginx_Proxy SHALL route the request to Presenton_Backend on port 8000
2. WHEN a request path starts with `/api/` but not `/api/v1/` THEN the Nginx_Proxy SHALL route the request to PPP_Backend on port 4000
3. WHEN a request path starts with `/app_data/` THEN the Nginx_Proxy SHALL route the request to Presenton_Backend and apply a 1-year cache expiry header
4. WHEN a request path does not match any API or asset prefix THEN the Nginx_Proxy SHALL route the request to Unified_Frontend on port 3000
5. THE Nginx_Proxy SHALL include WebSocket upgrade headers for frontend connections
6. THE Nginx_Proxy SHALL set a read timeout of 30 minutes for Presenton_Backend requests to accommodate long-running AI generation

### Requirement 3: PPP Backend Business Logic

**User Story:** As a marketing analyst, I want the existing project management, calculation, and report features preserved, so that my workflow is uninterrupted after the merge.

#### Acceptance Criteria

1. THE PPP_Backend SHALL provide REST API endpoints for project CRUD operations (create, read, update, list)
2. THE PPP_Backend SHALL provide data ingestion endpoints accepting spreadsheet and document uploads
3. THE PPP_Backend SHALL execute the metrics calculation pipeline (KPI, content analysis, traffic analysis) and return structured results
4. THE PPP_Backend SHALL generate report narratives via LLM integration and return complete report data including modules, metrics, and narrative content
5. THE PPP_Backend SHALL export reports to PDF, Word, and Excel formats
6. WHEN a project name is provided THEN the PPP_Backend SHALL validate that the name is non-empty and does not exceed 200 characters

### Requirement 4: PPT Generation Orchestration

**User Story:** As a marketing analyst, I want to generate presentations from my review reports, so that I can quickly produce professional slide decks from project data.

#### Acceptance Criteria

1. WHEN a user requests PPT generation for a project THEN the PPT_Orchestration_Layer SHALL load the project report data, assemble content into a format suitable for Presenton_Backend, and call the Presenton generation API
2. WHEN assembling content for Presenton_Backend THEN the PPT_Orchestration_Layer SHALL include all report modules with status "show" and format tables as valid markdown
3. WHEN Presenton_Backend returns a successful generation result THEN the PPT_Orchestration_Layer SHALL return a presentation ID, an edit URL, and a download URL to the client
4. WHEN assembling content THEN the PPT_Orchestration_Layer SHALL produce a non-empty content string that includes project metadata
5. THE PPT_Orchestration_Layer SHALL not mutate the source report data during content assembly

### Requirement 5: Presenton Backend Independence

**User Story:** As a system architect, I want the Presenton backend to operate as an independent microservice, so that it can be developed, deployed, and scaled separately from the PPP system.

#### Acceptance Criteria

1. THE Presenton_Backend SHALL start, serve requests, and shut down independently of PPP_Backend
2. THE Presenton_Backend SHALL provide REST API endpoints for presentation generation, editing, export (PPTX/PDF), template listing, image generation, icon search, and theme management
3. THE Presenton_Backend SHALL support multi-provider LLM integration (OpenAI, Anthropic, Google, Azure, Ollama) for slide content generation
4. THE Presenton_Backend SHALL persist presentation data in its own database (SQLite or PostgreSQL) separate from PPP's database
5. WHEN Presenton_Backend receives a generation request THEN the Presenton_Backend SHALL generate slides, save the PPTX file to file storage, and return the presentation ID and file path

### Requirement 6: Authentication and Authorization

**User Story:** As a user, I want a single login to access all features, so that I do not need separate credentials for PPP and Presenton functionality.

#### Acceptance Criteria

1. THE PPP_Backend SHALL authenticate users via JWT tokens for all API requests
2. THE Presenton_Backend SHALL authenticate service-to-service calls from PPP_Backend via API key passed in the `X-API-Key` header
3. WHEN a frontend user accesses Presenton features THEN the Unified_Frontend SHALL route the request through PPP_Backend's auth layer so that no separate Presenton credentials are required
4. THE Presenton_Backend SHALL not be directly exposed to the internet; access SHALL only be possible via Nginx_Proxy (which requires authentication) or the internal Docker network
5. IF an API request lacks a valid JWT token THEN the PPP_Backend SHALL return HTTP 401 Unauthorized
6. IF a service-to-service request lacks a valid API key THEN the Presenton_Backend SHALL return HTTP 401 Unauthorized

### Requirement 7: Service Resilience and Error Handling

**User Story:** As a user, I want non-PPT features to remain available even when the presentation service is down, so that my core workflow is not blocked by a single service failure.

#### Acceptance Criteria

1. IF Presenton_Backend is unavailable THEN the PPP_Backend SHALL return HTTP 503 to the client with a message indicating PPT generation is temporarily unavailable
2. WHILE Presenton_Backend is unavailable, the PPP_Backend SHALL continue serving all non-PPT features (project management, reports, exports) normally
3. WHEN calling Presenton_Backend THEN the PPP_Backend SHALL implement retry with exponential backoff up to a maximum of 3 attempts before returning an error
4. IF PPT generation exceeds 5 minutes THEN the PPP_Backend SHALL return HTTP 504 with a timeout indication
5. THE PPP_Backend SHALL poll Presenton_Backend's health endpoint every 30 seconds and expose service status to the frontend

### Requirement 8: Docker Compose Deployment

**User Story:** As a DevOps engineer, I want all services orchestrated via Docker Compose, so that the entire platform can be deployed and managed with a single command.

#### Acceptance Criteria

1. THE Docker_Orchestrator SHALL define containers for Nginx_Proxy, Unified_Frontend, PPP_Backend, Presenton_Backend, and PostgreSQL database
2. THE Docker_Orchestrator SHALL configure service dependencies so that PPP_Backend starts after the database, and Nginx_Proxy starts after all application services
3. THE Docker_Orchestrator SHALL use named volumes for PostgreSQL data persistence and Presenton file storage
4. THE Docker_Orchestrator SHALL expose only port 80 (Nginx) to the host; all other services SHALL communicate over the internal Docker network
5. THE Docker_Orchestrator SHALL pass configuration via environment variables, with no secrets committed to source control

### Requirement 9: Data Integrity During Migration

**User Story:** As a system administrator, I want existing data preserved during the merge, so that no project data or presentations are lost.

#### Acceptance Criteria

1. THE migration process SHALL preserve all existing PPP project data in PostgreSQL without alteration
2. THE migration process SHALL preserve all existing Presenton presentation data without alteration
3. THE PPP_Backend SHALL continue using Prisma with PostgreSQL for its data layer
4. THE Presenton_Backend SHALL continue using SQLAlchemy with Alembic for its data layer
5. THE merged system SHALL maintain separate databases for PPP and Presenton with no shared tables or cross-database foreign keys

### Requirement 10: Frontend State Management

**User Story:** As a developer, I want a unified state management approach that avoids conflicts between PPP and Presenton state, so that both feature sets work correctly in the same application.

#### Acceptance Criteria

1. THE Redux_Store SHALL namespace all Presenton state slices under a `presentation` prefix to avoid naming conflicts with PPP state slices
2. THE Redux_Store SHALL use Redux Toolkit's `combineSlices` to isolate PPP and Presenton state domains
3. WHEN the Unified_Frontend loads a PPP page THEN the Redux_Store SHALL provide access to PPP state slices (auth, projects, report) without loading Presenton editor state
4. WHEN the Unified_Frontend loads a Presenton page THEN the Redux_Store SHALL provide access to Presenton state slices (presentation, editor, theme) alongside auth state

### Requirement 11: Repository Structure

**User Story:** As a developer, I want a clear monorepo structure separating frontend, PPP backend, and Presenton backend, so that each component can be developed and built independently.

#### Acceptance Criteria

1. THE merged repository SHALL organize code into `frontend/` (unified Next.js app), `backend/` (PPP Node.js service), and `presenton/` (FastAPI service) top-level directories
2. THE `frontend/` directory SHALL contain the unified Next.js 16 application with app router pages, shared components, API client libraries, and the Redux store
3. THE `backend/` directory SHALL contain the PPP Node.js/TypeScript source code and Prisma schema
4. THE `presenton/` directory SHALL contain the FastAPI application with routes, services, and SQLAlchemy models
5. THE repository root SHALL contain `docker-compose.yml`, `nginx.conf`, and project-level documentation

### Requirement 12: Frontend Performance

**User Story:** As a user, I want the application to load quickly regardless of which feature I am using, so that I have a responsive experience.

#### Acceptance Criteria

1. THE Unified_Frontend SHALL code-split by route so that Presenton editor components are only loaded when a user navigates to presentation pages
2. THE Nginx_Proxy SHALL serve Presenton image and icon assets with 1-year cache headers
3. WHEN a user requests PPT generation THEN the PPP_Backend SHALL process the request asynchronously and return a job ID for the client to poll, rather than blocking the HTTP connection

### Requirement 13: Security

**User Story:** As a security engineer, I want proper network isolation and secrets management, so that internal services are not exposed and credentials are protected.

#### Acceptance Criteria

1. THE Nginx_Proxy SHALL handle CORS headers; backend services SHALL only accept requests from the internal Docker network
2. THE Docker_Orchestrator SHALL store all API keys, database credentials, and LLM keys as environment variables, never in source control
3. THE PPP_Backend SHALL authenticate to Presenton_Backend using a rotatable API key passed via environment variable
4. THE Presenton_Backend SHALL reject requests that do not originate from the internal Docker network or lack a valid API key
