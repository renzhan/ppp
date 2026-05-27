# ============================================================
# Stage 1: Install system deps + npm packages
# ============================================================
FROM node:22-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libpango1.0-dev \
    libcairo2-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm install --prefer-offline

# ============================================================
# Stage 2: Generate Prisma client + build root TS
# ============================================================
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json prisma.config.ts ./
COPY src/ ./src/
COPY prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build

# ============================================================
# Stage 3: Build Next.js app
# ============================================================
FROM node:22-bookworm-slim AS web-builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root node_modules (needed for transpilePackages resolution)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated

# Copy web node_modules from deps stage
COPY --from=deps /app/web/node_modules ./web/node_modules

COPY web/ ./web/

# Next.js transpilePackages uses ../src/ relative to web directory
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY package.json ./

WORKDIR /app/web

# Provide a dummy DATABASE_URL so Prisma client can initialize during static generation.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm run build

# ============================================================
# Stage 4: Production image (Node.js + Python + Supervisor)
# ============================================================
FROM node:22-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    fonts-wqy-zenhei \
    fonts-noto-cjk \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_FAST_API=http://127.0.0.1:8000
ENV NEXTJS_INTERNAL_URL=http://127.0.0.1:3000
ENV APP_DATA_DIRECTORY=/app_data

# --- Root node_modules (for Prisma CLI, etc.) ---
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# --- Next.js artifacts ---
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/next.config.mjs ./web/next.config.mjs

# --- Source (needed by Next.js transpilePackages at runtime for SSR) ---
COPY src/ ./src/

# --- Presenton FastAPI ---
COPY presenton-api/ ./presenton-api/
RUN python3 -m pip install --no-cache-dir --break-system-packages -r presenton-api/requirements.txt

# --- Shared data volume ---
RUN mkdir -p /app_data
VOLUME /app_data

# --- Supervisord config ---
COPY presenton-api/supervisord.conf /app/presenton-api/supervisord.conf
RUN sed -i 's/\r$//' /app/presenton-api/supervisord.conf

# --- Entrypoint: run Prisma migrations then start supervisor ---
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
