-- AlterTable: Add phone column to users table
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);

-- CreateIndex: Add unique index on phone (partial - only non-null values)
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
