#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
npx prisma migrate deploy 2>&1 || echo "Migrations skipped (may already be applied)"

echo "Starting services via Supervisor..."
exec supervisord -c /app/presenton-api/supervisord.conf
