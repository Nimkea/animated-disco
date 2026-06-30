import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("Prisma schema safety contracts", () => {
  it("keeps referral commission payouts idempotent per transaction/referrer/level", () => {
    expect(schema).toContain("model ReferralCommission");
    expect(schema).toContain("@@unique([transactionId, referrerId, level])");
  });

  it("keeps admin audit log model available for high-risk wallet actions", () => {
    expect(schema).toContain("model AdminAuditLog");
    expect(schema).toContain("adminUserId");
    expect(schema).toContain("action");
    expect(schema).toContain("entityType");
  });
});
