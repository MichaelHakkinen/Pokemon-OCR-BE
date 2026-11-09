import { execSync } from 'child_process';
import { E2E_DATABASE_URL } from './e2e-env';

// Fresh schema + seed data once per `npm run test:e2e`.
export default function globalSetup() {
  const run = (cmd: string) =>
    execSync(cmd, {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    });

  try {
    run('npx prisma migrate reset --force');
    run('npx tsx prisma/seed.ts');
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message: string };
    throw new Error(
      `E2E database setup failed for ${E2E_DATABASE_URL}\n` +
        `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? e.message}`,
    );
  }
}
