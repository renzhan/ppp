#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
npx prisma migrate deploy 2>&1 || echo "Migrations skipped (may already be applied)"

echo "Starting Next.js..."
cd /app/web
exec npx next start
