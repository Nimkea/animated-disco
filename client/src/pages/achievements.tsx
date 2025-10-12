import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock, CheckCircle2, TrendingUp, Users, Flame, Pickaxe } from "lucide-react";
import type { Achievement, UserAchievement } from "@shared/schema";
import { useConfetti } from "@/hooks/use-confetti";

export default function Achievements() {
  const { celebrate } = useConfetti();
  
  const { data: achievements } = useQuery<(Achievement & { unlocked?: boolean; unlockedAt?: string })[]>({
    queryKey: ["/api/achievements"],
  });
  
  // Trigger confetti when clicking on unlocked achievement
  const handleAchievementClick = (achievement: Achievement & { unlocked?: boolean }) => {
    if (achievement.unlocked) {
      celebrate('achievement');
    }
  };

  const categories = {
    earnings: { label: "Earnings", icon: TrendingUp, color: "text-chart-2" },
    referrals: { label: "Referrals", icon: Users, color: "text-chart-1" },
    streaks: { label: "Streaks", icon: Flame, color: "text-orange-500" },
    mining: { label: "Mining", icon: Pickaxe, color: "text-chart-3" },
  };

  const groupedAchievements = achievements?.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, typeof achievements>);

  const totalAchievements = achievements?.length || 0;
  const unlockedAchievements = achievements?.filter(a => a.unlocked).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Achievements</h1>
        <p className="text-muted-foreground">Track your progress and unlock rewards</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-4xl font-bold font-mono">
                {unlockedAchievements}/{totalAchievements}
              </p>
            </div>
            <Trophy className="h-16 w-16 text-primary" />
          </div>
          <Progress value={(unlockedAchievements / totalAchievements) * 100} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            {Math.round((unlockedAchievements / totalAchievements) * 100)}% Complete
          </p>
        </CardContent>
      </Card>

      {groupedAchievements && Object.entries(groupedAchievements).map(([category, categoryAchievements]) => {
        const categoryInfo = categories[category as keyof typeof categories];
        const CategoryIcon = categoryInfo?.icon || Trophy;
        const unlockedCount = categoryAchievements.filter(a => a.unlocked).length;

        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryIcon className={`h-5 w-5 ${categoryInfo?.color || "text-primary"}`} />
                  <CardTitle className="capitalize">{categoryInfo?.label || category}</CardTitle>
                </div>
                <Badge variant="secondary">
                  {unlockedCount}/{categoryAchievements.length}
                </Badge>
              </div>
              <CardDescription>
                {categoryInfo?.label || category} achievements and milestones
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {categoryAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  onClick={() => handleAchievementClick(achievement)}
                  className={`p-4 border rounded-md transition-all ${
                    achievement.unlocked 
                      ? "border-chart-2/30 bg-chart-2/5 cursor-pointer hover:bg-chart-2/10 hover:border-chart-2/50" 
                      : "border-border bg-muted/50"
                  }`}
                  data-testid={`achievement-${achievement.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
                      achievement.unlocked 
                        ? "bg-chart-2/20" 
                        : "bg-muted"
                    }`}>
                      {achievement.unlocked ? (
                        <CheckCircle2 className="h-6 w-6 text-chart-2" />
                      ) : (
                        <Lock className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold truncate">{achievement.title}</h4>
                        {achievement.unlocked && (
                          <Badge variant="outline" className="bg-chart-1/10 flex-shrink-0">
                            +{achievement.xpReward} XP
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                      {!achievement.unlocked && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Requirement:</span>
                          <span className="font-semibold">{achievement.requirement.toLocaleString()}</span>
                        </div>
                      )}
                      {achievement.unlocked && achievement.unlockedAt && (
                        <p className="text-xs text-muted-foreground">
                          Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!achievements || achievements.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No achievements yet</p>
            <p className="text-sm text-muted-foreground mt-2">Start earning to unlock achievements</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
