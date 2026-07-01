import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ListChecks,
  CheckCircle2,
  Sparkles,
  Calendar,
  Star,
  UserCircle,
  Gem,
  Pickaxe,
  Users,
  Flame,
  Gauge,
  Trophy,
} from "lucide-react";
import type { Task, UserTask } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useConfetti } from "@/hooks/use-confetti";

type UserTaskWithTask = UserTask & { task?: Task | null };

interface EngagementSummary {
  config?: { levelXpStep: number };
  xp: {
    total: number;
    level: number;
    label?: string;
    progressPercent: number;
    xpIntoLevel: number;
    xpRequiredForLevel: number;
  };
  caps: {
    daily: { remainingTotal: number; totalCap: number; remainingTask: number; taskCap: number };
    weekly: { remainingTotal: number; totalCap: number; remainingTask: number; taskCap: number };
  };
}

const CATEGORY_ORDER = [
  "onboarding",
  "engagement",
  "daily",
  "weekly",
  "staking",
  "mining",
  "referrals",
  "profile",
  "wallet",
  "special",
];

function getCategoryMeta(category: string) {
  switch (category) {
    case "daily":
      return { label: "Daily", icon: Calendar, color: "text-chart-1" };
    case "weekly":
      return { label: "Weekly", icon: Star, color: "text-chart-2" };
    case "onboarding":
    case "profile":
      return { label: "Onboarding", icon: UserCircle, color: "text-chart-1" };
    case "staking":
      return { label: "Staking", icon: Gem, color: "text-chart-2" };
    case "mining":
      return { label: "Mining", icon: Pickaxe, color: "text-chart-3" };
    case "referrals":
      return { label: "Referrals", icon: Users, color: "text-chart-4" };
    case "engagement":
      return { label: "Engagement", icon: Flame, color: "text-orange-500" };
    default:
      return { label: category ? category.replace(/_/g, " ") : "Special", icon: Sparkles, color: "text-chart-5" };
  }
}

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { celebrate } = useConfetti();

  const { data: userTasks = [], isLoading } = useQuery<UserTaskWithTask[]>({
    queryKey: ["/api/tasks/user"],
  });

  const { data: engagementSummary } = useQuery<EngagementSummary>({
    queryKey: ["/api/engagement/summary"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      const previousXP = user?.xp ?? 0;
      const newXP = previousXP + (data.xpReward || 0);
      const levelStep = Math.max(100, engagementSummary?.config?.levelXpStep || 1000);
      const previousLevel = Math.floor(previousXP / levelStep) + 1;
      const newLevel = Math.floor(newXP / levelStep) + 1;
      const leveledUp = newLevel > previousLevel;

      toast({
        title: "Task Completed!",
        description: `You earned ${data.xpReward} XP and ${data.xnrtReward} XNRT${data.rewardCapped ? " (daily/weekly cap applied)" : ""}!`,
      });

      if (leveledUp) {
        celebrate("levelup");
      } else {
        celebrate("achievement");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/tasks/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement/summary"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    },
  });

  const visibleTasks = userTasks.filter((userTask) => Boolean(userTask.task));
  const completedCount = visibleTasks.filter((userTask) => userTask.completed).length;
  const totalTasks = visibleTasks.length;
  const availableXnrt = visibleTasks
    .filter((userTask) => !userTask.completed)
    .reduce((sum, userTask) => sum + parseFloat(userTask.task?.xnrtReward || "0"), 0);

  const xpProgress = engagementSummary?.xp;
  const dailyRemaining = engagementSummary?.caps?.daily?.remainingTotal ?? 0;
  const dailyCap = engagementSummary?.caps?.daily?.totalCap ?? 0;

  const groupedTasks = visibleTasks.reduce<Record<string, UserTaskWithTask[]>>((acc, userTask) => {
    const category = userTask.task?.category || "special";
    if (!acc[category]) acc[category] = [];
    acc[category].push(userTask);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedTasks).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Tasks</h1>
        <p className="text-muted-foreground">Complete tasks to earn XP and capped in-app XNRT engagement rewards</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Available Tasks</p>
              <ListChecks className="h-5 w-5 text-chart-1" />
            </div>
            <p className="text-3xl font-bold font-mono">{totalTasks}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Completed</p>
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
            </div>
            <p className="text-3xl font-bold font-mono">
              {completedCount}/{totalTasks}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Unclaimed Rewards</p>
              <Sparkles className="h-5 w-5 text-chart-5" />
            </div>
            <p className="text-3xl font-bold font-mono">{availableXnrt.toLocaleString()} XNRT</p>
            <p className="mt-1 text-xs text-muted-foreground">Daily cap remaining: {dailyRemaining.toLocaleString()} / {dailyCap.toLocaleString()} XNRT</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Engagement Level</p>
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold font-mono">Level {xpProgress?.level ?? user?.level ?? 1}</p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{xpProgress?.label || "Member"}</span>
                <span>{xpProgress?.progressPercent ?? 0}%</span>
              </div>
              <Progress value={xpProgress?.progressPercent ?? 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading tasks…
          </CardContent>
        </Card>
      )}

      {!isLoading && groupedEntries.map(([category, tasks]) => {
        const meta = getCategoryMeta(category);
        const CategoryIcon = meta.icon;
        const completedInCategory = tasks.filter((task) => task.completed).length;

        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 capitalize">
                  <CategoryIcon className={`h-5 w-5 ${meta.color}`} />
                  {meta.label}
                </CardTitle>
                <Badge variant="secondary">
                  {completedInCategory}/{tasks.length}
                </Badge>
              </div>
              <CardDescription>Complete {meta.label.toLowerCase()} tasks and collect rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.map((userTask) => (
                <TaskItem
                  key={userTask.id}
                  userTask={userTask}
                  onComplete={() => completeTaskMutation.mutate(userTask.taskId)}
                  isPending={completeTaskMutation.isPending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!isLoading && totalTasks === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ListChecks className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No tasks available</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later for new tasks</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TaskItem({
  userTask,
  onComplete,
  isPending,
}: {
  userTask: UserTaskWithTask;
  onComplete: () => void;
  isPending: boolean;
}) {
  const task = userTask.task;
  if (!task) return null;

  const progress = userTask.maxProgress > 0 ? (userTask.progress / userTask.maxProgress) * 100 : 0;
  const meta = getCategoryMeta(task.category);
  const CategoryIcon = meta.icon;
  const canComplete = !userTask.completed && (userTask.maxProgress <= 1 || userTask.progress >= userTask.maxProgress);

  return (
    <div
      className="flex flex-col gap-4 border border-border rounded-md p-4 hover-elevate md:flex-row md:items-center md:justify-between"
      data-testid={`task-${userTask.id}`}
    >
      <div className="flex items-start gap-4 flex-1">
        <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
          userTask.completed ? "bg-chart-2/20" : "bg-muted"
        }`}>
          {userTask.completed ? (
            <CheckCircle2 className="h-6 w-6 text-chart-2" />
          ) : (
            <CategoryIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold">{task.title}</p>
            <Badge variant="secondary" className="capitalize">{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
          {task.requirements && (
            <p className="text-xs text-muted-foreground mb-2">Requirement: {task.requirements}</p>
          )}
          {!userTask.completed && userTask.maxProgress > 1 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{userTask.progress}/{userTask.maxProgress}</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end md:ml-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-chart-1/10">
            +{task.xpReward} XP
          </Badge>
          {parseFloat(task.xnrtReward) > 0 && (
            <Badge variant="outline" className="bg-chart-2/10">
              +{parseFloat(task.xnrtReward).toLocaleString()} XNRT
            </Badge>
          )}
        </div>
        {userTask.completed ? (
          <Badge variant="default" className="bg-chart-2">Completed</Badge>
        ) : (
          <Button
            size="sm"
            disabled={!canComplete || isPending}
            onClick={onComplete}
            data-testid={`button-complete-${userTask.id}`}
          >
            {canComplete ? "Complete" : "In Progress"}
          </Button>
        )}
      </div>
    </div>
  );
}
