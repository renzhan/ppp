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
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
until node -e "const net=require('net');const s=net.connect({host:'${DB_HOST}',port:${DB_PORT}},()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not reachable at ${DB_HOST}:${DB_PORT} after ${MAX_RETRIES}s. Continuing anyway..."
    break
  fi
  echo "  Database not ready at ${DB_HOST}:${DB_PORT}, retrying in 1s... ($RETRY/$MAX_RETRIES)"
  sleep 1
done

echo "Running database migrations..."
cd /app
echo "  Checking prisma files..."
ls -la prisma/schema.prisma prisma.config.ts 2>&1 || echo "  WARNING: Some prisma files missing!"
set +e
npx prisma db push --config prisma.config.ts --accept-data-loss 2>&1
PUSH_EXIT=$?
set -e
if [ $PUSH_EXIT -ne 0 ]; then
  echo "WARNING: prisma db push failed (exit=$PUSH_EXIT). Attempting migrate deploy..."
  set +e
  npx prisma migrate deploy --config prisma.config.ts 2>&1
  set -e
fi

# Apply manual migrations that are not managed by Prisma
echo "Applying manual migrations (if not already applied)..."
if [ -f prisma/migrations/manual_add_note_base_table.sql ]; then
  npx prisma db execute --file prisma/migrations/manual_add_note_base_table.sql --config prisma.config.ts 2>&1 || echo "note_base table may already exist, skipping."
fi

echo "Starting Next.js..."
cd /app/web
exec node_modules/.bin/next start -p 3000 2>&1
