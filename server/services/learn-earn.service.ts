import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { notifyUser } from "../notifications";
import { storage } from "../storage";
import { awardUserXpWithLedger, calculateAllowedXnrtReward } from "./engagement.service";
import { recordMissionEvent } from "./reward.service";

const db = prisma as any;

const DEFAULT_LESSONS = [
  {
    slug: "responsible-usage-safety",
    title: "Responsible Usage & Safety",
    summary: "Learn safe habits, reward limits, and why XNRT avoids guaranteed profit claims.",
    content:
      "XNRT rewards are engagement credits inside the platform experience. Do not treat simulated rewards, staking estimates, or referral bonuses as guaranteed income. Keep your account secure, avoid duplicate accounts, never share passwords, and report suspicious activity. Responsible users follow daily caps, complete real tasks, and use the platform for learning and participation.",
    category: "responsible_usage",
    estimatedMinutes: 4,
    xpReward: 60,
    xnrtReward: "15",
    passingScore: 70,
    isResponsibleUsage: true,
    sortOrder: 10,
    questions: [
      {
        question: "What should users avoid in XNRT?",
        options: ["Creating fake accounts for rewards", "Reading lessons", "Checking their wallet", "Claiming one daily reward"],
        correctAnswer: 0,
        explanation: "Duplicate/fake accounts are abuse and should be blocked by admin controls.",
      },
      {
        question: "How should simulated rewards be understood?",
        options: ["As guaranteed profit", "As internal engagement credits", "As bank interest", "As a fixed salary"],
        correctAnswer: 1,
        explanation: "Rewards should be presented as platform engagement credits, not guaranteed income.",
      },
      {
        question: "Which habit improves account safety?",
        options: ["Sharing your password", "Using one real account", "Ignoring alerts", "Using duplicate wallets"],
        correctAnswer: 1,
        explanation: "One real account and secure login habits reduce abuse and account risk.",
      },
    ],
  },
  {
    slug: "what-is-xnrt",
    title: "What is XNRT?",
    summary: "Understand the basic idea of XNRT, XP, levels, and platform rewards.",
    content:
      "XNRT is the platform reward unit used inside this app. XP is separate from XNRT and represents reputation, activity, and level progress. XP helps unlock status, badges, missions, and eligibility signals without inflating token-style balances. XNRT rewards should remain capped and auditable.",
    category: "xnrt_basics",
    estimatedMinutes: 3,
    xpReward: 40,
    xnrtReward: "10",
    passingScore: 70,
    isResponsibleUsage: false,
    sortOrder: 20,
    questions: [
      {
        question: "What does XP mainly represent?",
        options: ["A withdrawal fee", "Activity and reputation", "A password", "A deposit address"],
        correctAnswer: 1,
        explanation: "XP is non-monetary progress used for levels and reputation.",
      },
      {
        question: "Why are reward caps important?",
        options: ["To make farming unlimited", "To reduce abuse and inflation", "To hide rewards", "To remove missions"],
        correctAnswer: 1,
        explanation: "Caps help keep rewards controlled and auditable.",
      },
      {
        question: "Which item is safest for status progression?",
        options: ["XP levels", "Unlimited referral bonuses", "Guaranteed APY text", "Random gambling boxes"],
        correctAnswer: 0,
        explanation: "XP levels add engagement without promising profit.",
      },
    ],
  },
  {
    slug: "wallet-deposits-basics",
    title: "Wallet & Deposits Basics",
    summary: "Learn how wallet pages, deposit addresses, and reports should be used carefully.",
    content:
      "The wallet page shows balances and activity. Deposit addresses must be checked carefully before sending funds. Users should only report real transactions and keep transaction hashes safe. Admin review, verification, and audit logs help protect the platform from fake deposit claims.",
    category: "wallet",
    estimatedMinutes: 3,
    xpReward: 35,
    xnrtReward: "8",
    passingScore: 70,
    isResponsibleUsage: false,
    sortOrder: 30,
    questions: [
      {
        question: "What should a user check before deposit?",
        options: ["The deposit address", "Only the app color", "A random wallet", "Nothing"],
        correctAnswer: 0,
        explanation: "Wallet address accuracy is critical.",
      },
      {
        question: "Why are transaction hashes useful?",
        options: ["They verify blockchain activity", "They replace passwords", "They create fake rewards", "They delete accounts"],
        correctAnswer: 0,
        explanation: "Transaction hashes help verify real on-chain transfers.",
      },
      {
        question: "Fake deposit claims should be:",
        options: ["Rewarded", "Ignored forever", "Reviewed and blocked", "Used for XP farming"],
        correctAnswer: 2,
        explanation: "Admin review and anti-abuse controls protect platform balances.",
      },
    ],
  },
  {
    slug: "staking-and-trust-loan",
    title: "Staking & Trust Loan Readiness",
    summary: "Understand staking participation, eligibility signals, and safe wording.",
    content:
      "Staking screens can show simulated rewards and eligibility progress, but they must avoid guaranteed profit wording. Trust Loan readiness should be based on responsible engagement, referral quality, account age, verified activity, and admin controls. Users should read program terms before participating.",
    category: "staking",
    estimatedMinutes: 4,
    xpReward: 45,
    xnrtReward: "12",
    passingScore: 70,
    isResponsibleUsage: false,
    sortOrder: 40,
    questions: [
      {
        question: "What wording should be avoided?",
        options: ["Eligibility progress", "Guaranteed profit", "Responsible usage", "Admin review"],
        correctAnswer: 1,
        explanation: "Guaranteed profit claims are risky and should not be used.",
      },
      {
        question: "Trust Loan readiness should consider:",
        options: ["Only balance", "Responsible engagement and verified activity", "Duplicate accounts", "Random clicks only"],
        correctAnswer: 1,
        explanation: "Eligibility should combine multiple quality signals.",
      },
      {
        question: "Before staking or loan participation, users should:",
        options: ["Read the terms", "Ignore warnings", "Use fake referrals", "Skip safety lessons"],
        correctAnswer: 0,
        explanation: "Terms and safety notices help set clear expectations.",
      },
    ],
  },
] as const;

type LessonPayload = {
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  category?: unknown;
  estimatedMinutes?: unknown;
  xpReward?: unknown;
  xnrtReward?: unknown;
  passingScore?: unknown;
  isActive?: unknown;
  isResponsibleUsage?: unknown;
  sortOrder?: unknown;
};

type QuestionPayload = {
  question?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  sortOrder?: unknown;
};

function normalizeSlug(value: unknown, fallbackTitle = "lesson") {
  const base = String(value || fallbackTitle)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "lesson";
}

function toBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return !["false", "0", "no", "off"].includes(String(value).toLowerCase());
}

function toInt(value: unknown, fallback: number, min = 0, max = 10_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function toDecimalString(value: unknown, fallback = "0") {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed.toString();
}

function normalizeOptions(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
    } catch {
      return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
  }
  return [];
}

function parseStoredOptions(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return [];
    }
  }
  return [];
}

function serializeProgress(progress: any) {
  if (!progress) return null;
  return {
    id: progress.id,
    userId: progress.userId,
    lessonId: progress.lessonId,
    status: progress.status,
    score: Number(progress.score || 0),
    totalQuestions: Number(progress.totalQuestions || 0),
    correctAnswers: Number(progress.correctAnswers || 0),
    passed: Boolean(progress.passed),
    rewarded: Boolean(progress.rewarded),
    xpReward: Number(progress.xpReward || 0),
    xnrtReward: progress.xnrtReward?.toString?.() ?? String(progress.xnrtReward ?? "0"),
    requestedXnrtReward: progress.requestedXnrtReward?.toString?.() ?? String(progress.requestedXnrtReward ?? "0"),
    rewardCapped: Boolean(progress.rewardCapped),
    completedAt: progress.completedAt,
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
  };
}

function serializeQuestion(question: any, includeAnswer = false) {
  const output: any = {
    id: question.id,
    lessonId: question.lessonId,
    question: question.question,
    options: parseStoredOptions(question.options),
    explanation: question.explanation || null,
    sortOrder: Number(question.sortOrder || 0),
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
  if (includeAnswer) output.correctAnswer = Number(question.correctAnswer || 0);
  return output;
}

export function serializeLesson(lesson: any, options: { includeAnswers?: boolean; progress?: any } = {}) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    content: lesson.content,
    category: lesson.category,
    estimatedMinutes: Number(lesson.estimatedMinutes || 0),
    xpReward: Number(lesson.xpReward || 0),
    xnrtReward: lesson.xnrtReward?.toString?.() ?? String(lesson.xnrtReward ?? "0"),
    passingScore: Number(lesson.passingScore || 70),
    isActive: Boolean(lesson.isActive),
    isResponsibleUsage: Boolean(lesson.isResponsibleUsage),
    sortOrder: Number(lesson.sortOrder || 0),
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    questions: Array.isArray(lesson.questions)
      ? lesson.questions.map((question: any) => serializeQuestion(question, Boolean(options.includeAnswers)))
      : [],
    progress: serializeProgress(options.progress || lesson.progress?.[0]),
  };
}

export function parseLessonPayload(body: LessonPayload) {
  const title = String(body?.title || "").trim();
  const summary = String(body?.summary || "").trim();
  const content = String(body?.content || "").trim();
  if (!title || !summary || !content) throw new Error("Title, summary, and content are required");

  return {
    slug: normalizeSlug(body?.slug, title),
    title,
    summary,
    content,
    category:
      String(body?.category || "education")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_") || "education",
    estimatedMinutes: toInt(body?.estimatedMinutes, 3, 1, 120),
    xpReward: toInt(body?.xpReward, 25, 0, 10_000),
    xnrtReward: new Prisma.Decimal(toDecimalString(body?.xnrtReward, "0")),
    passingScore: toInt(body?.passingScore, 70, 1, 100),
    isActive: toBoolean(body?.isActive, true),
    isResponsibleUsage: toBoolean(body?.isResponsibleUsage, false),
    sortOrder: toInt(body?.sortOrder, 0, 0, 10_000),
  };
}

export function parseLessonQuestionPayload(body: QuestionPayload) {
  const question = String(body?.question || "").trim();
  const options = normalizeOptions(body?.options);
  const correctAnswer = toInt(body?.correctAnswer, 0, 0, Math.max(options.length - 1, 0));
  if (!question) throw new Error("Question is required");
  if (options.length < 2) throw new Error("At least two options are required");
  if (correctAnswer >= options.length) throw new Error("Correct answer index is outside the options list");

  return {
    question,
    options,
    correctAnswer,
    explanation: String(body?.explanation || "").trim() || null,
    sortOrder: toInt(body?.sortOrder, 0, 0, 10_000),
  };
}

export async function ensureDefaultLessons() {
  for (const lesson of DEFAULT_LESSONS) {
    const { questions, ...lessonData } = lesson;
    const saved = await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      create: { ...lessonData, xnrtReward: new Prisma.Decimal(lesson.xnrtReward) },
      update: { ...lessonData, xnrtReward: new Prisma.Decimal(lesson.xnrtReward) },
    });

    for (let index = 0; index < questions.length; index += 1) {
      const q = questions[index];
      const existing = await prisma.lessonQuestion.findFirst({ where: { lessonId: saved.id, sortOrder: index + 1 } });
      const data = {
        question: q.question,
        options: q.options as any,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        sortOrder: index + 1,
      };
      if (existing) await prisma.lessonQuestion.update({ where: { id: existing.id }, data });
      else await prisma.lessonQuestion.create({ data: { ...data, lessonId: saved.id } });
    }
  }
}

export async function getLessonsForUser(userId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { isActive: true },
    include: {
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      progress: { where: { userId } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return lessons.map((lesson: any) => serializeLesson(lesson));
}

export async function getLessonForUser(userId: string, slugOrId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { isActive: true, OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: {
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      progress: { where: { userId } },
    },
  });
  return lesson ? serializeLesson(lesson) : null;
}

export async function submitLessonQuiz(userId: string, slugOrId: string, answersInput: unknown) {
  const lesson = await prisma.lesson.findFirst({
    where: { isActive: true, OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!lesson) return { ok: false as const, status: 404, message: "Lesson not found" };

  const questions = (lesson.questions || []) as any[];
  if (questions.length === 0) return { ok: false as const, status: 400, message: "Lesson has no quiz questions" };

  const answers = typeof answersInput === "object" && answersInput !== null ? (answersInput as Record<string, unknown>) : {};
  let correctAnswers = 0;
  const answerSummary = questions.map((question) => {
    const submitted = toInt(answers[question.id], -1, -1, 100);
    const correct = submitted === Number(question.correctAnswer);
    if (correct) correctAnswers += 1;
    return {
      questionId: question.id,
      submittedAnswer: submitted,
      correctAnswer: Number(question.correctAnswer),
      correct,
    };
  });

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const passed = score >= Number(lesson.passingScore || 70);
  const existing = await db.userLessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
  const alreadyRewarded = Boolean(existing?.rewarded);

  let xpReward = 0;
  let awardedXnrt = 0;
  let requestedXnrt = 0;
  let rewardCapped = false;
  const now = new Date();

  if (passed && !alreadyRewarded) {
    xpReward = Number(lesson.xpReward || 0);
    requestedXnrt = Number(lesson.xnrtReward || 0);

    if (xpReward > 0) {
      await awardUserXpWithLedger({
        userId,
        amount: xpReward,
        reason: `Learn & Earn lesson passed: ${lesson.title}`,
        source: "learn_quiz",
        sourceId: lesson.id,
        metadata: { lessonId: lesson.id, lessonSlug: lesson.slug, score },
      });
    }

    if (requestedXnrt > 0) {
      const capResult = await calculateAllowedXnrtReward({
        userId,
        requestedAmount: requestedXnrt,
        source: "learn_quiz",
        sourceId: lesson.id,
        reason: `Learn & Earn quiz reward: ${lesson.title}`,
      });
      awardedXnrt = capResult.awardedAmount;
      rewardCapped = capResult.capped;

      if (awardedXnrt > 0) {
        const balance = await storage.getBalance(userId);
        if (balance) {
          await storage.updateBalance(userId, {
            xnrtBalance: (parseFloat(balance.xnrtBalance) + awardedXnrt).toString(),
            totalEarned: (parseFloat(balance.totalEarned) + awardedXnrt).toString(),
          });
        }

        await storage.createTransaction({
          userId,
          type: "reward",
          amount: awardedXnrt.toString(),
          source: "learn_quiz",
          status: "approved",
          approvedAt: now,
          verified: true,
        });
      }
    }

    await storage.createActivity({
      userId,
      type: "lesson_completed",
      description: `Passed Learn & Earn lesson: ${lesson.title} (${score}%) +${xpReward} XP +${awardedXnrt} XNRT${rewardCapped ? " capped" : ""}`,
      metadata: JSON.stringify({ lessonId: lesson.id, lessonSlug: lesson.slug, score, rewardCapped }),
    });

    void notifyUser(userId, {
      type: "learn_quiz_passed",
      title: "🎓 Quiz Reward Claimed",
      message: `You passed ${lesson.title} with ${score}% and earned ${xpReward} XP + ${awardedXnrt} XNRT${rewardCapped ? " after cap" : ""}.`,
      url: "/learn",
      metadata: { lessonId: lesson.id, lessonSlug: lesson.slug, score, xpReward, xnrtReward: awardedXnrt, rewardCapped },
    }).catch((err: unknown) => console.error("Error sending quiz reward notification:", err));

    await recordMissionEvent(userId, "lesson_completed", 1);
    await storage.checkAndUnlockAchievements(userId);
  }

  const saved = await db.userLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    create: {
      userId,
      lessonId: lesson.id,
      status: "completed",
      score,
      totalQuestions,
      correctAnswers,
      passed,
      rewarded: passed && !alreadyRewarded,
      xpReward,
      xnrtReward: new Prisma.Decimal(awardedXnrt.toString()),
      requestedXnrtReward: new Prisma.Decimal(requestedXnrt.toString()),
      rewardCapped,
      answers: answerSummary as any,
      completedAt: now,
    },
    update: {
      status: "completed",
      score,
      totalQuestions,
      correctAnswers,
      passed: existing?.passed || passed,
      rewarded: existing?.rewarded || (passed && !alreadyRewarded),
      xpReward: existing?.rewarded ? existing.xpReward : xpReward,
      xnrtReward: existing?.rewarded ? existing.xnrtReward : new Prisma.Decimal(awardedXnrt.toString()),
      requestedXnrtReward: existing?.rewarded ? existing.requestedXnrtReward : new Prisma.Decimal(requestedXnrt.toString()),
      rewardCapped: existing?.rewarded ? existing.rewardCapped : rewardCapped,
      answers: answerSummary as any,
      completedAt: now,
    },
  });

  return {
    ok: true as const,
    passed,
    alreadyRewarded,
    score,
    correctAnswers,
    totalQuestions,
    passingScore: Number(lesson.passingScore || 70),
    xpReward,
    xnrtReward: awardedXnrt.toString(),
    requestedXnrtReward: requestedXnrt.toString(),
    rewardCapped,
    progress: serializeProgress(saved),
    answers: answerSummary,
  };
}

export async function getAdminLessons() {
  const lessons = await prisma.lesson.findMany({
    include: {
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      _count: { select: { progress: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return lessons.map((lesson: any) => ({
    ...serializeLesson(lesson, { includeAnswers: true }),
    completions: lesson._count?.progress || 0,
  }));
}

export async function createLessonFromPayload(payload: LessonPayload) {
  const data = parseLessonPayload(payload);
  const lesson = await prisma.lesson.create({ data });
  return serializeLesson({ ...lesson, questions: [] }, { includeAnswers: true });
}

export async function updateLessonFromPayload(lessonId: string, payload: LessonPayload) {
  const data = parseLessonPayload(payload);
  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data,
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return serializeLesson(lesson, { includeAnswers: true });
}

export async function upsertLessonQuestion(lessonId: string, payload: QuestionPayload, questionId?: string) {
  const data = parseLessonQuestionPayload(payload);
  const saved = questionId
    ? await prisma.lessonQuestion.update({ where: { id: questionId }, data: data as any })
    : await prisma.lessonQuestion.create({ data: { ...data, lessonId } as any });
  return serializeQuestion(saved, true);
}

export async function deleteLessonQuestion(questionId: string) {
  await prisma.lessonQuestion.delete({ where: { id: questionId } });
  return { ok: true };
}
