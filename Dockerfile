# ============================================================
# Stage 1: Install system deps + npm packages
# ============================================================
FROM node:22-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    fonts-wqy-zenhei \
    fonts-noto-cjk \
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
RUN cd web && npm ci

# ============================================================
# Stage 2: Generate Prisma client + build root TS
# ============================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build

# ============================================================
# Stage 3: Build Next.js app
# ============================================================
FROM node:22-bookworm-slim AS web-builder

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated

COPY web/ ./web/

# Next.js transpilePackages uses ../src/ relative to web directory
COPY src/ ./src/

WORKDIR /app/web
RUN npm ci
RUN npm run build

# ============================================================
# Stage 4: Production image
# ============================================================
FROM node:22-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    fonts-wqy-zenhei \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/next.config.mjs ./web/next.config.mjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
