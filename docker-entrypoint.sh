#!/bin/sh
set -e

# Write environment variables to /app/.env so that dotenv.config() in Next.js can read them.
# docker-compose env_file only injects vars into the process environment,
# but the app uses dotenv to read from the filesystem at /app/.env.
echo "Writing environment to /app/.env for child processes..."
env | grep -E '^(DATABASE_URL|LLM_|QWEN_|JWT_|PAICHACHA_|ENCRYPTION_KEY|NODE_ENV|APP_DATA_DIRECTORY|PUGONGYING_|JUGUANG_|LINGXI_|QIANGUA_|CRON_SECRET|APP_BASE_URL|SENTIMENT_CRON_|DISABLE_SENTIMENT_CRON)' | while IFS= read -r line; do
  echo "$line"
done > /app/.env

# Wait for database to be ready (max 30 seconds)
echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY=0
until echo "SELECT 1" | npx prisma db execute --stdin --config prisma.config.ts > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not reachable after ${MAX_RETRIES}s. Continuing anyway..."
    break
  fi
  echo "  Database not ready, retrying in 1s... ($RETRY/$MAX_RETRIES)"
  sleep 1
done

echo "Running database migrations..."
cd /app
npx prisma migrate deploy --config prisma.config.ts 2>&1
MIGRATE_EXIT=$?
if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "WARNING: prisma migrate deploy failed (exit=$MIGRATE_EXIT)."
  echo "Attempting to resolve: marking all migrations as applied (init.sql likely already created tables)..."
  # Create _prisma_migrations table and mark all migrations as applied
  for dir in prisma/migrations/*/; do
    if [ -d "$dir" ]; then
      migration_name=$(basename "$dir")
      echo "  Resolving: $migration_name"
      npx prisma migrate resolve --applied "$migration_name" --config prisma.config.ts 2>&1 || true
    fi
  done
  echo "Migration resolve complete."
fi

# Apply manual migrations that are not managed by Prisma
echo "Applying manual migrations (if not already applied)..."
if [ -f prisma/migrations/manual_add_note_base_table.sql ]; then
  npx prisma db execute --file prisma/migrations/manual_add_note_base_table.sql --config prisma.config.ts 2>&1 || echo "note_base table may already exist, skipping."
fi

echo "Starting Next.js..."
cd /app/web
exec node_modules/.bin/next start -p 3000 2>&1
