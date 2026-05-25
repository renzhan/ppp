# Requirements Document

## Introduction

本文档定义了将 Presenton（AI 演示文稿生成器）深度集成到"派盘盘"(PPP) 数字营销平台的需求。集成范围包括：将 Presenton FastAPI 后端作为内部服务嵌入、升级审校台为 TipTap 富文本编辑器并接入 AI 辅助编辑、新增 PPT 生成与编辑流程、以及单 Docker 镜像部署方案。集成后，Presenton 不再需要独立认证，PPP 的 JWT 认证为唯一鉴权层。

## Glossary

- **PPP_Platform**: 派盘盘数字营销 AI 平台，基于 Next.js 14 App Router 前端 + Node.js/TypeScript 后端
- **Presenton_API**: Presenton 的 FastAPI 后端服务，提供 AI 驱动的演示文稿生成、编辑、导出功能
- **Proofread_Page**: 审校台页面（`/review/[id]/proofread`），用于复盘报告的编辑和审校
- **TipTap_Editor**: 基于 TipTap 的富文本编辑器组件，替代原有 textarea
- **AI_Assistant**: 审校台右侧的 AI 助手面板，调用 Presenton Chat API 进行智能内容编辑
- **PPT_Editor**: PPT 编辑器页面，嵌入 Presenton 的演示文稿编辑器，支持 AI 对话式修改幻灯片
- **Supervisor_Process**: 进程管理器，在单个 Docker 容器内同时运行 Next.js 和 Presenton FastAPI
- **API_Proxy**: Next.js API 路由层，将前端请求代理转发到本地 Presenton_API（localhost:8000）

## Requirements

### Requirement 1: Presenton FastAPI 内部服务集成

**User Story:** 作为平台运维人员，我希望 Presenton FastAPI 作为内部服务集成到 PPP 项目中，以便在同一部署单元内直接调用，无需外部网络通信。

#### Acceptance Criteria

1. THE PPP_Platform SHALL include Presenton FastAPI source code in the `presenton-api/` directory within the project repository
2. WHEN the Docker container starts, THE Supervisor_Process SHALL launch Presenton_API on port 8000 and Next.js on port 3000 within the same container
3. THE Presenton_API SHALL respond to health check requests at `/api/v1/health` within 5 seconds of container startup completion
4. THE Presenton_API SHALL provide REST API endpoints for presentation generation (`/api/v1/ppt/presentation/generate`), retrieval (`/api/v1/ppt/presentation/{id}`), chat editing (`/api/v1/ppt/chat`), and PPTX export (`/api/v1/ppt/presentation/export/pptx`)
5. WHEN Presenton_API receives any request, THE Presenton_API SHALL process it without requiring API key validation or session authentication
6. THE Presenton_API SHALL store generated presentation files in a shared volume accessible to both services

### Requirement 2: 移除 Presenton 独立认证

**User Story:** 作为开发者，我希望移除 Presenton 的独立认证机制，因为它现在是内部服务，由 PPP 的 JWT 认证统一保护。

#### Acceptance Criteria

1. THE Presenton_API SHALL not enforce API key middleware on any endpoint
2. THE Presenton_API SHALL not enforce session-based authentication on any endpoint
3. THE API_Proxy SHALL validate PPP JWT token before forwarding requests to Presenton_API
4. IF a request to API_Proxy lacks a valid PPP JWT token, THEN THE API_Proxy SHALL return HTTP 401 without forwarding to Presenton_API
5. THE Presenton_API SHALL only accept connections from localhost (127.0.0.1), rejecting external direct access attempts

### Requirement 3: 审校台 TipTap 富文本编辑器升级

**User Story:** 作为营销分析师，我希望审校台使用富文本编辑器替代纯文本框，以便更直观地编辑报告内容（包括标题、列表、表格、加粗等格式）。

#### Acceptance Criteria

1. WHEN the Proofread_Page loads, THE TipTap_Editor SHALL render the report content with rich text formatting (headings, bold, italic, lists, tables, blockquotes)
2. THE TipTap_Editor SHALL support Markdown-style shortcuts (e.g., `#` for heading, `**` for bold, `-` for list)
3. THE TipTap_Editor SHALL preserve all formatting when saving content to the backend
4. WHEN the user switches between chapters, THE TipTap_Editor SHALL save the current chapter content and load the new chapter content without data loss
5. THE TipTap_Editor SHALL support undo/redo operations with at least 100 history steps
6. THE Proofread_Page SHALL maintain the existing three-panel layout: chapter navigation (left), editor (center), AI assistant (right)

### Requirement 4: 审校台 AI 助手集成

**User Story:** 作为营销分析师，我希望审校台的 AI 助手能调用 Presenton Chat API 进行智能内容编辑，以便优化表达、补充数据、调整结构和润色文本。

#### Acceptance Criteria

1. WHEN the user sends a message to AI_Assistant, THE AI_Assistant SHALL call Presenton Chat API (`/api/v1/ppt/chat`) with the current chapter content as context
2. THE AI_Assistant SHALL support the following editing commands: optimize expression (优化表达), supplement data (补充数据), adjust structure (调整结构), polish text (润色文本)
3. WHEN AI_Assistant receives a response from Presenton Chat API, THE AI_Assistant SHALL display the response in the chat panel with proper formatting
4. WHEN AI_Assistant suggests content modifications, THE AI_Assistant SHALL provide an "apply" button that inserts the suggested content into TipTap_Editor at the current cursor position or replaces the selected text
5. IF Presenton Chat API is unavailable, THEN THE AI_Assistant SHALL display an error message indicating the AI service is temporarily unavailable
6. THE AI_Assistant SHALL send the current chapter title and content as context with each chat request to enable context-aware responses

### Requirement 5: PPT 流式生成流程

**User Story:** 作为营销分析师，我希望从审校台一键触发 PPT 生成，并实时看到每一页幻灯片的生成结果（生成一页显示一页），而不是等待全部完成才能查看。

#### Acceptance Criteria

1. THE Proofread_Page SHALL display a "Generate PPT" (生成PPT) button in the toolbar
2. WHEN the user clicks "Generate PPT", THE PPP_Platform SHALL call the prepare API (`/api/ppt/presentation/prepare`) to create a presentation record and obtain a presentation ID
3. AFTER obtaining the presentation ID, THE PPP_Platform SHALL immediately navigate to the PPT_Editor page and connect to the streaming endpoint (`/api/ppt/presentation/stream/{id}`) via Server-Sent Events
4. WHILE PPT generation is streaming, THE PPT_Editor SHALL render each slide as soon as it is received from the stream (生成一页显示一页), showing a progress indicator for remaining slides
5. WHEN all slides have been received (stream complete), THE PPT_Editor SHALL display the full presentation and enable all editing features
6. IF the streaming connection fails or times out, THEN THE PPT_Editor SHALL display an error message with a retry/reconnect button
7. THE PPT prepare request SHALL include project metadata (project name, brand, category) and all enabled report modules as content

### Requirement 6: PPT 编辑器页面

**User Story:** 作为营销分析师，我希望在 PPT 生成后进入一个完整的演示文稿编辑器，以便通过 AI 对话和直接编辑来修改幻灯片内容。

#### Acceptance Criteria

1. THE PPT_Editor SHALL be accessible at route `/review/[id]/ppt-editor/[presentationId]`
2. THE PPT_Editor SHALL display a three-panel layout: slide panel (left), slide canvas with TipTap editing (center), AI chat panel (right)
3. WHEN the PPT_Editor loads, THE PPT_Editor SHALL fetch presentation data from Presenton_API and render all slides
4. THE PPT_Editor SHALL allow users to edit slide content directly in the canvas area using TipTap
5. WHEN the user sends a message in the AI chat panel, THE PPT_Editor SHALL call Presenton Chat API to modify slides based on the user's instruction
6. WHEN the user requests slide modifications via AI chat, THE PPT_Editor SHALL update the affected slides in real-time without full page reload
7. THE PPT_Editor SHALL provide a "Download PPTX" button that exports the current presentation as a .pptx file
8. THE PPT_Editor SHALL provide a "Back to Proofread" (返回审校台) navigation link

### Requirement 7: API 代理层

**User Story:** 作为前端开发者，我希望通过 Next.js API 路由代理所有 Presenton 请求，以便统一认证和简化前端调用。

#### Acceptance Criteria

1. THE API_Proxy SHALL forward requests from `/api/ppt/*` to Presenton_API at `http://localhost:8000/api/v1/ppt/*`
2. THE API_Proxy SHALL strip PPP authentication headers and forward requests to Presenton_API without authentication headers
3. WHEN Presenton_API returns a response, THE API_Proxy SHALL forward the response body and status code to the client unchanged
4. IF Presenton_API does not respond within 300 seconds, THEN THE API_Proxy SHALL return HTTP 504 with a timeout error message
5. THE API_Proxy SHALL support streaming responses for chat API endpoints to enable real-time AI response display
6. THE API_Proxy SHALL log all forwarded requests with timestamp, method, path, and response status for debugging

### Requirement 8: 单 Docker 镜像部署

**User Story:** 作为运维人员，我希望通过单个 Docker 镜像部署整个平台（Next.js + Presenton FastAPI），以便简化部署和运维流程。

#### Acceptance Criteria

1. THE Docker image SHALL include both Next.js application and Presenton FastAPI application with all dependencies
2. WHEN the Docker container starts, THE Supervisor_Process SHALL start Next.js on port 3000 and Presenton_API on port 8000
3. THE Docker container SHALL expose only port 3000 to the host; Presenton_API port 8000 SHALL only be accessible within the container
4. IF Presenton_API process crashes, THEN THE Supervisor_Process SHALL automatically restart it within 5 seconds
5. IF Next.js process crashes, THEN THE Supervisor_Process SHALL automatically restart it within 5 seconds
6. THE Docker image SHALL include Python 3.11+ runtime, Node.js 22 runtime, and supervisor process manager
7. THE Docker image SHALL use a shared filesystem volume for Presenton's generated presentation files (PPTX, images)

### Requirement 9: 现有功能保持不变

**User Story:** 作为平台用户，我希望所有现有功能（登录、项目管理、复盘列表、复盘创建、舆情系统、管理后台）在集成后保持完全不变。

#### Acceptance Criteria

1. THE PPP_Platform SHALL preserve all existing page routes and their functionality: login (`/login`), project list (`/`), project creation (`/projects/new`), review list (`/review`), review creation (`/review/new`), review detail (`/review/[id]`), sentiment (`/sentiment`), admin settings (`/admin/settings`), admin users (`/admin/users`)
2. THE PPP_Platform SHALL preserve all existing API endpoints and their request/response contracts
3. THE PPP_Platform SHALL preserve the existing JWT authentication flow (login, token refresh, logout)
4. THE PPP_Platform SHALL preserve the existing database schema and data without migration-breaking changes
5. WHEN a user accesses any existing page, THE PPP_Platform SHALL render it with identical functionality and appearance as before the integration

### Requirement 10: Presenton Chat API 集成

**User Story:** 作为营销分析师，我希望 AI 对话功能能理解报告上下文并提供专业的营销分析建议，以便高效地优化报告内容。

#### Acceptance Criteria

1. WHEN calling Presenton Chat API, THE API_Proxy SHALL include the current document context (chapter content, project metadata) in the request payload
2. THE Presenton Chat API SHALL return responses in streaming format to enable progressive display in the UI
3. WHEN the AI response contains structured content (tables, lists, formatted text), THE AI_Assistant SHALL render it with proper formatting in the chat panel
4. THE AI_Assistant SHALL maintain conversation history within a session so that follow-up questions reference previous context
5. IF the AI response exceeds 30 seconds without any streaming data, THEN THE AI_Assistant SHALL display a timeout warning and offer to retry

### Requirement 11: PPT 编辑器幻灯片管理

**User Story:** 作为营销分析师，我希望在 PPT 编辑器中管理幻灯片（添加、删除、重排序），以便灵活调整演示文稿结构。

#### Acceptance Criteria

1. THE PPT_Editor slide panel SHALL display thumbnail previews of all slides in the presentation
2. WHEN the user clicks a slide thumbnail, THE PPT_Editor SHALL display that slide in the center canvas for editing
3. THE PPT_Editor SHALL allow users to reorder slides via drag-and-drop in the slide panel
4. THE PPT_Editor SHALL allow users to delete a slide from the presentation
5. THE PPT_Editor SHALL allow users to add a new blank slide at any position
6. WHEN any slide modification occurs (reorder, delete, add), THE PPT_Editor SHALL persist the change to Presenton_API immediately

### Requirement 12: 数据格式转换

**User Story:** 作为系统开发者，我希望报告内容能正确转换为 Presenton 可接受的格式，以便 PPT 生成结果准确反映报告数据。

#### Acceptance Criteria

1. WHEN generating PPT content, THE PPP_Platform SHALL convert report modules (KPI data, content analysis tables, traffic analysis tables) into valid Markdown format
2. THE content conversion SHALL preserve all numeric data values without rounding or truncation
3. THE content conversion SHALL include table headers and maintain column alignment in Markdown table format
4. FOR ALL valid report module data, converting to Markdown then parsing back SHALL produce equivalent data values (round-trip property)
5. WHEN a report module has status "hide", THE content conversion SHALL exclude that module from the PPT generation content
