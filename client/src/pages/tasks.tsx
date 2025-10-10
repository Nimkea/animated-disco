import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ListChecks, CheckCircle2, Sparkles, Calendar, Star } from "lucide-react";
import type { Task, UserTask } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Tasks() {
  const { toast } = useToast();

  const { data: userTasks } = useQuery<UserTask[]>({
    queryKey: ["/api/tasks/user"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Task Completed!",
        description: `You earned ${data.xpReward} XP and ${data.xnrtReward} XNRT!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
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

  const dailyTasks = userTasks?.filter((t: any) => t.task.category === "daily") || [];
  const weeklyTasks = userTasks?.filter((t: any) => t.task.category === "weekly") || [];
  const specialTasks = userTasks?.filter((t: any) => t.task.category === "special") || [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "daily":
        return Calendar;
      case "weekly":
        return Star;
      default:
        return Sparkles;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "daily":
        return "text-chart-1";
      case "weekly":
        return "text-chart-2";
      default:
        return "text-chart-5";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Tasks</h1>
        <p className="text-muted-foreground">Complete tasks to earn XP and XNRT rewards</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Daily Tasks</p>
              <Calendar className="h-5 w-5 text-chart-1" />
            </div>
            <p className="text-3xl font-bold font-mono">
              {dailyTasks.filter((t: any) => t.completed).length}/{dailyTasks.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Weekly Tasks</p>
              <Star className="h-5 w-5 text-chart-2" />
            </div>
            <p className="text-3xl font-bold font-mono">
              {weeklyTasks.filter((t: any) => t.completed).length}/{weeklyTasks.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Special Tasks</p>
              <Sparkles className="h-5 w-5 text-chart-5" />
            </div>
            <p className="text-3xl font-bold font-mono">
              {specialTasks.filter((t: any) => t.completed).length}/{specialTasks.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {dailyTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-chart-1" />
              Daily Tasks
            </CardTitle>
            <CardDescription>Complete daily to maintain your streak</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dailyTasks.map((userTask: any) => (
              <TaskItem
                key={userTask.id}
                userTask={userTask}
                onComplete={() => completeTaskMutation.mutate(userTask.taskId)}
                isPending={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {weeklyTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-chart-2" />
              Weekly Tasks
            </CardTitle>
            <CardDescription>Higher rewards for weekly completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weeklyTasks.map((userTask: any) => (
              <TaskItem
                key={userTask.id}
                userTask={userTask}
                onComplete={() => completeTaskMutation.mutate(userTask.taskId)}
                isPending={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {specialTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-chart-5" />
              Special Tasks
            </CardTitle>
            <CardDescription>Limited time tasks with bonus rewards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {specialTasks.map((userTask: any) => (
              <TaskItem
                key={userTask.id}
                userTask={userTask}
                onComplete={() => completeTaskMutation.mutate(userTask.taskId)}
                isPending={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {!userTasks || userTasks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ListChecks className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No tasks available</p>
            <p className="text-sm text-muted-foreground">Check back later for new tasks</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TaskItem({ userTask, onComplete, isPending }: { userTask: any; onComplete: () => void; isPending: boolean }) {
  const task = userTask.task;
  const progress = (userTask.progress / userTask.maxProgress) * 100;
  const CategoryIcon = task.category === "daily" ? Calendar : task.category === "weekly" ? Star : Sparkles;

  return (
    <div
      className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
      data-testid={`task-${userTask.id}`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
          userTask.completed ? "bg-chart-2/20" : "bg-muted"
        }`}>
          {userTask.completed ? (
            <CheckCircle2 className="h-6 w-6 text-chart-2" />
          ) : (
            <CategoryIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold">{task.title}</p>
            <Badge variant="secondary" className="capitalize">{task.category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
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
      <div className="text-right ml-4">
        <div className="flex items-center gap-2 mb-2">
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
            disabled={userTask.progress < userTask.maxProgress || isPending}
            onClick={onComplete}
            data-testid={`button-complete-${userTask.id}`}
          >
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}
