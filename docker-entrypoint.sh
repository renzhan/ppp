#!/bin/sh
set -e

# Write environment variables to /app/.env so that dotenv.config() in Next.js can read them.
# docker-compose env_file only injects vars into the process environment,
# but the app uses dotenv to read from the filesystem at /app/.env.
echo "Writing environment to /app/.env for child processes..."
env | grep -E '^(DATABASE_URL|LLM_|QWEN_|JWT_|PAICHACHA_|ENCRYPTION_KEY|NODE_ENV|APP_DATA_DIRECTORY)' | while IFS= read -r line; do
  echo "$line"
done > /app/.env

echo "Running database migrations..."
cd /app
npx prisma migrate deploy --config prisma.config.ts 2>&1 || echo "WARNING: Migrations failed (database may be unreachable). Continuing anyway..."

# Apply manual migrations that are not managed by Prisma
echo "Applying manual migrations (if not already applied)..."
if [ -f prisma/migrations/manual_add_note_base_table.sql ]; then
  npx prisma db execute --file prisma/migrations/manual_add_note_base_table.sql --config prisma.config.ts 2>&1 || echo "note_base table may already exist, skipping."
fi

echo "Starting Next.js..."
cd /app/web
exec node_modules/.bin/next start -p 3000
