import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, GraduationCap, HelpCircle, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Lesson, LessonQuestion, UserLessonProgress } from "@shared/schema";

type LessonWithProgress = Lesson & {
  questions: LessonQuestion[];
  progress?: UserLessonProgress | null;
};

type QuizResult = {
  passed: boolean;
  alreadyRewarded: boolean;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passingScore: number;
  xpReward: number;
  xnrtReward: string;
  rewardCapped: boolean;
};

function lessonStatus(lesson: LessonWithProgress) {
  if (lesson.progress?.rewarded) return "completed";
  if (lesson.progress?.passed) return "passed";
  if (lesson.progress?.status === "completed") return "attempted";
  return "available";
}

function categoryLabel(value?: string | null) {
  return String(value || "education").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function LearnEarn() {
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  const { data: lessons = [], isLoading } = useQuery<LessonWithProgress[]>({
    queryKey: ["/api/learn/lessons"],
  });

  const activeLesson = useMemo(() => {
    if (!lessons.length) return null;
    return lessons.find((lesson) => lesson.slug === activeSlug) || lessons[0];
  }, [lessons, activeSlug]);

  const completedLessons = lessons.filter((lesson) => lesson.progress?.rewarded).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;

  const submitMutation = useMutation({
    mutationFn: async (lesson: LessonWithProgress) => {
      const response = await apiRequest("POST", `/api/learn/lessons/${lesson.slug}/submit`, { answers });
      return response.json() as Promise<QuizResult>;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: data.passed ? "Quiz passed" : "Try again",
        description: data.passed
          ? `Score ${data.score}% — earned ${data.xpReward} XP and ${data.xnrtReward} XNRT${data.rewardCapped ? " after cap" : ""}.`
          : `Score ${data.score}%. Passing score is ${data.passingScore}%.`,
        variant: data.passed ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Quiz submit failed", description: error.message, variant: "destructive" });
    },
  });

  function selectLesson(lesson: LessonWithProgress) {
    setActiveSlug(lesson.slug);
    setAnswers({});
    setLastResult(null);
  }

  function canSubmit(lesson: LessonWithProgress) {
    return lesson.questions.length > 0 && lesson.questions.every((question) => typeof answers[question.id] === "number");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3 gap-1">
            <GraduationCap className="h-3.5 w-3.5" /> Learn & Earn
          </Badge>
          <h1 className="text-3xl font-bold font-serif">Learn & Earn Quiz System</h1>
          <p className="text-muted-foreground">Read short lessons, pass quizzes, complete the Responsible Usage lesson, and claim one-time XP + XNRT education rewards.</p>
        </div>
        <Card className="min-w-[220px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lesson Progress</span>
              <span className="font-mono font-semibold">{completedLessons}/{lessons.length}</span>
            </div>
            <Progress value={progressPercent} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
        <div className="space-y-3">
          {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading lessons…</CardContent></Card>}
          {!isLoading && lessons.map((lesson) => {
            const status = lessonStatus(lesson);
            const isActive = activeLesson?.id === lesson.id;
            return (
              <button
                key={lesson.id}
                onClick={() => selectLesson(lesson)}
                className={cn(
                  "w-full rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary/5",
                  isActive && "border-primary/50 bg-primary/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {lesson.isResponsibleUsage ? <ShieldCheck className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
                      <p className="font-semibold">{lesson.title}</p>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{lesson.summary}</p>
                  </div>
                  {status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <HelpCircle className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{categoryLabel(lesson.category)}</Badge>
                  <Badge variant="secondary">{lesson.estimatedMinutes} min</Badge>
                  <Badge variant="secondary">+{lesson.xpReward} XP</Badge>
                  <Badge variant="secondary">+{lesson.xnrtReward} XNRT</Badge>
                </div>
              </button>
            );
          })}
        </div>

        {activeLesson ? (
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    {activeLesson.isResponsibleUsage ? <ShieldCheck className="h-6 w-6 text-primary" /> : <BookOpen className="h-6 w-6 text-primary" />}
                    {activeLesson.title}
                  </CardTitle>
                  <CardDescription>{activeLesson.summary}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Passing score {activeLesson.passingScore}%</Badge>
                  {activeLesson.progress?.rewarded && <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Rewarded</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="rounded-xl border bg-background p-5 leading-7 text-sm text-muted-foreground whitespace-pre-line">
                {activeLesson.content}
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Quiz</h2>
                  <p className="text-sm text-muted-foreground">Answer all questions to unlock the claim reward button.</p>
                </div>

                {activeLesson.questions.map((question, index) => (
                  <div key={question.id} className="rounded-xl border p-4">
                    <p className="font-medium">{index + 1}. {question.question}</p>
                    <div className="mt-3 grid gap-2">
                      {question.options.map((option, optionIndex) => {
                        const selected = answers[question.id] === optionIndex;
                        return (
                          <button
                            key={`${question.id}-${optionIndex}`}
                            onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary/40",
                              selected && "border-primary bg-primary/10 text-primary"
                            )}
                          >
                            {String.fromCharCode(65 + optionIndex)}. {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {lastResult && (
                <div className={cn("rounded-xl border p-4", lastResult.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10")}>
                  <p className="font-semibold">Score: {lastResult.score}% ({lastResult.correctAnswers}/{lastResult.totalQuestions})</p>
                  <p className="text-sm text-muted-foreground">
                    {lastResult.passed
                      ? `Reward: ${lastResult.xpReward} XP + ${lastResult.xnrtReward} XNRT${lastResult.rewardCapped ? " after daily cap" : ""}.`
                      : `Passing score is ${lastResult.passingScore}%. Read the lesson again and retry.`}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {activeLesson.progress?.rewarded ? (
                    <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" /> Reward already claimed for this lesson.</span>
                  ) : (
                    <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> One reward per lesson. Fail attempts can be retried.</span>
                  )}
                </div>
                <Button
                  disabled={!canSubmit(activeLesson) || submitMutation.isPending}
                  onClick={() => submitMutation.mutate(activeLesson)}
                  className="gap-2"
                >
                  <GraduationCap className="h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : activeLesson.progress?.rewarded ? "Retake Quiz" : "Submit & Claim Reward"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="p-10 text-center text-muted-foreground">No lessons available yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
