import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = {
  processMiningRewards: vi.fn(),
  getCurrentMiningSession: vi.fn(),
  getMiningHistory: vi.fn(),
  createMiningSession: vi.fn(),
};

vi.mock("../../server/storage", () => ({
  storage: storageMock,
  MINING_SESSION_DURATION_MS: 24 * 60 * 60 * 1000,
  MINING_SESSION_XNRT_REWARD: 5,
  MINING_SESSION_XP_REWARD: 10,
}));

describe("mining service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T00:00:00.000Z"));
    storageMock.processMiningRewards.mockResolvedValue(undefined);
    storageMock.getCurrentMiningSession.mockReset();
    storageMock.getMiningHistory.mockReset();
    storageMock.createMiningSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a 24-hour session with exactly 10 XP and 5 XNRT reward metadata", async () => {
    const { startMiningSessionForUser } = await import("../../server/services/mining.service");
    storageMock.getCurrentMiningSession.mockResolvedValue(null);
    storageMock.createMiningSession.mockImplementation(async (input) => ({
      id: "session-1",
      ...input,
    }));

    const result = await startMiningSessionForUser("user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected mining session to start");
    expect(storageMock.createMiningSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        baseReward: 10,
        finalReward: 10,
        status: "active",
      })
    );
    expect(result.session.reward).toEqual({ xp: 10, xnrt: 5, durationHours: 24 });
    expect(result.session.endTime.getTime() - result.session.startTime.getTime()).toBe(
      24 * 60 * 60 * 1000
    );
  });

  it("does not start a second active mining session", async () => {
    const { startMiningSessionForUser } = await import("../../server/services/mining.service");
    storageMock.getCurrentMiningSession.mockResolvedValue({ id: "active-1", status: "active" });

    const result = await startMiningSessionForUser("user-1");

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "You already have an active mining session",
    });
    expect(storageMock.createMiningSession).not.toHaveBeenCalled();
  });
});
