import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

// Load environment variables before creating the Prisma client
config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
