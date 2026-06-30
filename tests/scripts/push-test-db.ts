import { spawnSync } from "node:child_process";
import { maskDatabaseUrl, requireSafeTestDatabaseUrl } from "../helpers/test-database";

const url = requireSafeTestDatabaseUrl();
console.log(`[test-db] Running prisma db push against ${maskDatabaseUrl(url)}`);

const result = spawnSync("pnpm", ["prisma", "db", "push"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(result.status ?? 1);
