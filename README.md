# Unified Platform — PPP + Presenton

A merged platform combining the PPP marketing review/report system with Presenton's AI-powered presentation generator.

## Monorepo Structure

```
├── frontend/              Unified Next.js 16 + React 19 web application
├── backend/               PPP Node.js/TypeScript backend (business logic, Prisma)
├── presenton/             Presenton FastAPI backend (AI/PPT generation)
├── docker-compose.yml     Docker Compose orchestration for all services
├── nginx.conf             Nginx reverse proxy configuration
├── .env.example           Environment variable template
└── README.md              This file
```

## Services

| Service | Technology | Port | Description |
|---------|-----------|------|-------------|
| Frontend | Next.js 16, React 19 | 3000 | Unified web UI for both PPP and Presenton |
| PPP Backend | Node.js, TypeScript, Prisma | 4000 | Project management, reports, exports |
| Presenton Backend | Python, FastAPI | 8000 | AI presentation generation, PPTX export |
| Nginx | Nginx Alpine | 80 | Reverse proxy, request routing |
| Database | PostgreSQL 16 | 5432 | PPP business data |

## Request Routing

Nginx routes incoming requests to the appropriate service:

- `/api/v1/*` → Presenton Backend (AI/PPT APIs)
- `/api/*` → PPP Backend (business APIs)
- `/app_data/*` → Presenton Backend (static assets, cached)
- `/*` → Frontend (all other routes)

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env
# Edit .env with your configuration

# 2. Start all services
docker-compose up -d

# 3. Access the application
open http://localhost
```

## Development

Each service can be developed independently:

```bash
# Frontend
cd frontend && npm install && npm run dev

# PPP Backend
cd backend && npm install && npm run dev

# Presenton Backend
cd presenton && pip install -e . && uvicorn main:app --reload --port 8000
```
