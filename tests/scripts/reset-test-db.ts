import { spawnSync } from "node:child_process";
import {
  maskDatabaseUrl,
  requireResetAllowed,
  requireSafeTestDatabaseUrl,
} from "../helpers/test-database";

const url = requireSafeTestDatabaseUrl();
requireResetAllowed();

console.warn(`[test-db] FORCE RESET enabled for ${maskDatabaseUrl(url)}`);
console.warn("[test-db] This must be a disposable test database only.");

const result = spawnSync(
  "pnpm",
  ["prisma", "db", "push", "--force-reset", "--accept-data-loss"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  }
);

process.exit(result.status ?? 1);
