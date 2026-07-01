import { useMutation, useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Flame, Gem, Lock, Medal, Pickaxe, ShieldCheck, Sparkles, Star, Target, Trophy, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useConfetti } from "@/hooks/use-confetti";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Achievement } from "@shared/schema";

type AchievementWithStatus = Achievement & {
  unlocked?: boolean;
  unlockedAt?: string | Date | null;
  claimed?: boolean;
  claimedAt?: string | Date | null;
  claimable?: boolean;
  isFeatured?: boolean;
  featuredSlot?: number | null;
  badgeTierRank?: number;
};

const CATEGORY_META: Record<string, { label: string; icon: any; description: string }> = {
  onboarding: { label: "Onboarding", icon: ShieldCheck, description: "Account setup and profile readiness" },
  wallet: { label: "Wallet", icon: Wallet, description: "Wallet and deposit readiness" },
  earnings: { label: "Earnings", icon: Sparkles, description: "Lifetime XNRT earning milestones" },
  referrals: { label: "Referrals", icon: Users, description: "Network-building milestones" },
  streaks: { label: "Streaks", icon: Flame, description: "Daily check-in consistency" },
  mining: { label: "Mining", icon: Pickaxe, description: "Mining participation milestones" },
  tasks: { label: "Missions", icon: Target, description: "Daily missions and weekly quest milestones" },
  staking: { label: "Staking", icon: Gem, description: "Staking activity milestones" },
  trust_loan: { label: "Trust Loan", icon: Medal, description: "Trust Loan readiness milestones" },
};

const TIER_ORDER = ["bronze", "silver", "gold", "diamond"];

function getTierLabel(tier?: string | null) {
  const value = String(tier || "bronze").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTierClass(tier?: string | null) {
  switch (String(tier || "bronze").toLowerCase()) {
    case "diamond":
      return "border-cyan-400/40 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200";
    case "gold":
      return "border-yellow-400/40 bg-yellow-400/10 text-yellow-700 dark:text-yellow-200";
    case "silver":
      return "border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-200";
    case "bronze":
    default:
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
}

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] || { label: category.replace(/_/g, " "), icon: Trophy, description: "Special platform badge" };
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function Achievements() {
  const { celebrate } = useConfetti();
  const { toast } = useToast();

  const { data: achievements = [], isLoading } = useQuery<AchievementWithStatus[]>({
    queryKey: ["/api/achievements"],
  });

  const claimMutation = useMutation({
    mutationFn: async (achievementId: string) => {
      const response = await apiRequest("POST", `/api/achievements/${achievementId}/claim`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Badge claimed", description: "Badge status updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
      celebrate("achievement");
    },
    onError: (error: Error) => {
      toast({ title: "Claim failed", description: error.message || "Could not claim badge", variant: "destructive" });
    },
  });

  const featureMutation = useMutation({
    mutationFn: async ({ achievementId, featured }: { achievementId: string; featured: boolean }) => {
      const response = await apiRequest("POST", `/api/achievements/${achievementId}/feature`, { featured });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.featured ? "Added to trophy case" : "Removed from trophy case",
        description: variables.featured ? "This badge will appear on your profile." : "Your Profile Trophy Case has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
      celebrate("achievement");
    },
    onError: (error: Error) => {
      toast({ title: "Trophy case update failed", description: error.message || "Could not update trophy case", variant: "destructive" });
    },
  });

  const totalAchievements = achievements.length;
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked).length;
  const featuredBadges = achievements.filter((achievement) => achievement.unlocked && achievement.isFeatured).length;
  const overallProgress = totalAchievements > 0 ? Math.round((unlockedAchievements / totalAchievements) * 100) : 0;

  const tierCounts = TIER_ORDER.map((tier) => ({
    tier,
    total: achievements.filter((achievement) => achievement.badgeTier === tier).length,
    unlocked: achievements.filter((achievement) => achievement.badgeTier === tier && achievement.unlocked).length,
  }));

  const groupedAchievements = achievements.reduce<Record<string, AchievementWithStatus[]>>((acc, achievement) => {
    const category = achievement.category || "special";
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedAchievements).sort(([a], [b]) => {
    const ai = Object.keys(CATEGORY_META).indexOf(a);
    const bi = Object.keys(CATEGORY_META).indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Achievements</h1>
        <p className="text-muted-foreground">Unlock bronze, silver, gold, and diamond badges for your Profile Trophy Case</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Overall Badge Progress</p>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold font-mono">{unlockedAchievements}/{totalAchievements}</p>
                <Badge variant="secondary" className="mb-1">{overallProgress}% complete</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{featuredBadges}/4 badges currently featured in your Trophy Case</p>
            </div>
            <Trophy className="h-16 w-16 text-primary" />
          </div>
          <Progress value={overallProgress} className="mt-5 h-3" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tierCounts.map((item) => (
              <div key={item.tier} className={`rounded-xl border p-3 ${getTierClass(item.tier)}`}>
                <p className="text-sm font-semibold">{getTierLabel(item.tier)}</p>
                <p className="text-2xl font-bold font-mono">{item.unlocked}/{item.total}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">Loading achievements…</CardContent>
        </Card>
      )}

      {!isLoading && groupedEntries.map(([category, categoryAchievements]) => {
        const categoryInfo = getCategoryMeta(category);
        const CategoryIcon = categoryInfo.icon;
        const unlockedCount = categoryAchievements.filter((achievement) => achievement.unlocked).length;

        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-5 w-5 text-primary" />
                  <CardTitle className="capitalize">{categoryInfo.label}</CardTitle>
                </div>
                <Badge variant="secondary">{unlockedCount}/{categoryAchievements.length}</Badge>
              </div>
              <CardDescription>{categoryInfo.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {categoryAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  onClaim={() => claimMutation.mutate(achievement.id)}
                  onFeature={() => featureMutation.mutate({ achievementId: achievement.id, featured: !achievement.isFeatured })}
                  isPending={claimMutation.isPending || featureMutation.isPending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!isLoading && totalAchievements === 0 && (
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

function AchievementCard({
  achievement,
  onClaim,
  onFeature,
  isPending,
}: {
  achievement: AchievementWithStatus;
  onClaim: () => void;
  onFeature: () => void;
  isPending: boolean;
}) {
  const unlocked = Boolean(achievement.unlocked);
  const tierClass = getTierClass(achievement.badgeTier);
  const tierLabel = getTierLabel(achievement.badgeTier);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${unlocked ? "bg-card hover:-translate-y-0.5 hover:shadow-md" : "bg-muted/40 opacity-80"}`}
      data-testid={`achievement-${achievement.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl ${tierClass}`}>
          {unlocked ? achievement.icon || "🏆" : <Lock className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{achievement.title}</h4>
            <Badge variant="outline" className={tierClass}>{tierLabel}</Badge>
            {achievement.isFeatured && <Badge variant="default" className="gap-1"><Star className="h-3 w-3" /> Trophy</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{achievement.description}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Requirement: {achievement.requirement.toLocaleString()}</Badge>
            <Badge variant="outline">+{achievement.xpReward} XP</Badge>
            {unlocked && achievement.unlockedAt && <span>Unlocked {formatDate(achievement.unlockedAt)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {unlocked ? (
          <>
            {achievement.claimable && (
              <Button size="sm" variant="outline" onClick={onClaim} disabled={isPending} data-testid={`button-claim-badge-${achievement.id}`}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Claim
              </Button>
            )}
            <Button size="sm" variant={achievement.isFeatured ? "secondary" : "default"} onClick={onFeature} disabled={isPending} data-testid={`button-feature-badge-${achievement.id}`}>
              <Star className="mr-2 h-4 w-4" /> {achievement.isFeatured ? "Remove Trophy" : "Add Trophy"}
            </Button>
          </>
        ) : (
          <Badge variant="secondary"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>
        )}
      </div>
    </div>
  );
}
