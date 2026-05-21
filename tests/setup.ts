import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

beforeAll(async () => {
  // Global test setup
  // Database transaction setup is handled per-test in tests/helpers/db-transaction.ts
});

afterAll(async () => {
  // Global test teardown
});
