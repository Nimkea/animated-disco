import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Activity,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Flame,
  Mail,
  Pencil,
  Save,
  Share2,
  ShieldCheck,
  Target,
  Trophy,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

interface ProfileSummary {
  profile: {
    id: string;
    username: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    referralCode: string;
    referredBy?: string | null;
    referredByUsername?: string | null;
    referredByCode?: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  xp: {
    total: number;
    level: number;
    label?: string;
    currentLevelXp: number;
    nextLevelXp: number;
    xpIntoLevel: number;
    xpRequiredForLevel: number;
    progressPercent: number;
  };
  balance: {
    xnrtBalance: number;
    stakingBalance: number;
    miningBalance: number;
    referralBalance: number;
    totalEarned: number;
  };
  referrals: {
    direct: number;
    level2: number;
    level3: number;
    totalNetwork: number;
    totalCommission: number;
    rank: number | null;
  };
  mining: {
    completedSessions: number;
    totalXpMined: number;
    totalXnrtMined: number;
  };
  staking: {
    activeStakes: number;
    totalActiveStaked: number;
  };
  tasks: {
    assigned: number;
    completed: number;
    totalActive: number;
    progressPercent: number;
  };
  achievements: {
    unlocked: number;
    total: number;
    progressPercent: number;
  };
  leaderboard: {
    xpRank: number | null;
    referralRank: number | null;
  };
  checkin: {
    currentStreak: number;
    lastCheckIn?: string | Date | null;
    checkedInToday: boolean;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string | Date;
  }>;
}

interface ProfileFormState {
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}

function formatNumber(value: number | string | null | undefined, maximumFractionDigits = 2) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString(undefined, { maximumFractionDigits });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "N/A";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "N/A";
  }
}

function getInitials(user?: Partial<UserType> | ProfileSummary["profile"] | null) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || user?.email || "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "??";
}

function getDisplayName(user?: ProfileSummary["profile"] | null) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return fullName || user?.username || "XNRT User";
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-72 md:col-span-1" />
        <Skeleton className="h-72 md:col-span-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [formState, setFormState] = useState<ProfileFormState>({
    username: "",
    firstName: "",
    lastName: "",
    profileImageUrl: "",
  });

  const { data: user, isLoading: userLoading, isError: userError } = useQuery<UserType>({
    queryKey: ["/auth/me"],
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<ProfileSummary>({
    queryKey: ["/api/profile/summary"],
  });

  const profile = summary?.profile || user;
  const displayName = getDisplayName(profile as ProfileSummary["profile"]);
  const initials = getInitials(profile);

  const referralLink = useMemo(() => {
    const code = profile?.referralCode || user?.referralCode || "";
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/register?ref=${encodeURIComponent(code)}`;
  }, [profile?.referralCode, user?.referralCode]);

  useEffect(() => {
    if (!profile) return;
    setFormState({
      username: profile.username || "",
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      profileImageUrl: profile.profileImageUrl || "",
    });
  }, [profile?.username, profile?.firstName, profile?.lastName, profile?.profileImageUrl]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormState) => {
      const payload = {
        username: data.username.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        profileImageUrl: data.profileImageUrl.trim(),
      };
      const response = await apiRequest("PATCH", "/api/profile", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your profile information has been saved." });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Profile update failed",
        description: error.message || "Please check your profile details and try again.",
        variant: "destructive",
      });
    },
  });

  async function copyText(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: value });
    } catch {
      toast({ title: "Copy failed", description: "Please copy it manually.", variant: "destructive" });
    }
  }

  async function shareReferral() {
    if (!referralLink) return;
    const shareData = {
      title: "Join XNRT",
      text: `Join XNRT using my referral code ${profile?.referralCode}`,
      url: referralLink,
    };

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled native share; keep copy fallback below.
      }
    }

    await copyText(referralLink, "Referral link");
  }

  if (userLoading || summaryLoading) return <ProfileSkeleton />;

  if (userError || summaryError || !profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <User className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Could not load profile</h1>
          <p className="text-muted-foreground">Refresh the page or sign in again to view your profile.</p>
        </CardContent>
      </Card>
    );
  }

  const level = summary?.xp.level ?? user?.level ?? 1;
  const xpTotal = summary?.xp.total ?? user?.xp ?? 0;
  const xpProgress = summary?.xp.progressPercent ?? Math.min(100, Math.round(((xpTotal % 1000) / 1000) * 100));
  const levelLabel = summary?.xp.label || "Member";
  const referralCode = profile.referralCode || user?.referralCode || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Profile</h1>
          <p className="text-muted-foreground">Your account hub, rewards progress, referrals, and earning stats</p>
        </div>
        <Button onClick={() => setEditOpen(true)} data-testid="button-edit-profile">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-28 w-28 mb-4 border-4 border-primary/10">
                <AvatarImage src={profile.profileImageUrl || ""} alt={displayName} />
                <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-secondary text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold font-serif" data-testid="text-profile-name">{displayName}</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-username">@{profile.username}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-email">
                <Mail className="h-4 w-4" />
                {profile.email}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <Award className="h-4 w-4 text-primary" />
                  Level {level} · {levelLabel}
                </Badge>
                <Badge variant={summary?.checkin.checkedInToday ? "default" : "secondary"} className="gap-2 px-3 py-1.5">
                  <Flame className="h-4 w-4" />
                  {summary?.checkin.currentStreak ?? user?.streak ?? 0} day streak
                </Badge>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">{formatDate(profile.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Check-in status</span>
                <span className="font-medium">
                  {summary?.checkin.checkedInToday ? "Done today" : "Pending today"}
                </span>
              </div>
              {summary?.profile.referredByUsername && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Referred by</span>
                  <span className="truncate font-medium">@{summary.profile.referredByUsername}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>XP Progress</CardTitle>
              <CardDescription>Earn XP from mining, tasks, achievements, referrals, and check-ins</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-4xl font-bold font-mono" data-testid="text-xp">{formatNumber(xpTotal, 0)} XP</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(summary?.xp.xpIntoLevel ?? xpTotal % 1000, 0)} / {formatNumber(summary?.xp.xpRequiredForLevel ?? 1000, 0)} XP toward Level {level + 1}
                  </p>
                </div>
                <Badge className="w-fit gap-2 px-4 py-2">
                  <Trophy className="h-4 w-4" />
                  XP Rank {summary?.leaderboard.xpRank ? `#${summary.leaderboard.xpRank}` : "N/A"}
                </Badge>
              </div>
              <Progress value={xpProgress} className="h-3" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="text-lg font-bold">{summary?.tasks.completed ?? 0}/{summary?.tasks.totalActive ?? 0}</p>
                  <Progress value={summary?.tasks.progressPercent ?? 0} className="mt-2 h-2" />
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Achievements</p>
                  <p className="text-lg font-bold">{summary?.achievements.unlocked ?? 0}/{summary?.achievements.total ?? 0}</p>
                  <Progress value={summary?.achievements.progressPercent ?? 0} className="mt-2 h-2" />
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Referral Rank</p>
                  <p className="text-lg font-bold">{summary?.leaderboard.referralRank ? `#${summary.leaderboard.referralRank}` : "N/A"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Network: {summary?.referrals.totalNetwork ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referral Hub</CardTitle>
              <CardDescription>Copy your code or share your invite link with friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Your referral code</p>
                  <code className="block truncate text-lg font-bold" data-testid="text-referral-code">{referralCode || "N/A"}</code>
                </div>
                <div className="flex gap-2 md:justify-end">
                  <Button variant="outline" onClick={() => copyText(referralCode, "Referral code")} disabled={!referralCode}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </Button>
                  <Button onClick={shareReferral} disabled={!referralLink}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Invite link</p>
                <button
                  type="button"
                  className="mt-1 w-full truncate text-left text-sm font-mono hover:underline"
                  onClick={() => copyText(referralLink, "Referral link")}
                  disabled={!referralLink}
                >
                  {referralLink || "Referral link unavailable"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="XNRT Balance" value={`${formatNumber(summary?.balance.xnrtBalance)} XNRT`} description="Available main balance" icon={Wallet} />
        <StatCard title="Total Earned" value={`${formatNumber(summary?.balance.totalEarned)} XNRT`} description="Lifetime platform earnings" icon={Coins} />
        <StatCard title="Mining" value={`${formatNumber(summary?.mining.totalXpMined, 0)} XP`} description={`${summary?.mining.completedSessions ?? 0} completed sessions`} icon={Activity} />
        <StatCard title="Active Stakes" value={formatNumber(summary?.staking.activeStakes, 0)} description={`${formatNumber(summary?.staking.totalActiveStaked)} XNRT staked`} icon={ShieldCheck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Referral Network</CardTitle>
            <CardDescription>Your multi-level referral performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border p-3">
                <p className="text-2xl font-bold">{summary?.referrals.direct ?? 0}</p>
                <p className="text-xs text-muted-foreground">Direct</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-2xl font-bold">{summary?.referrals.level2 ?? 0}</p>
                <p className="text-xs text-muted-foreground">Level 2</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-2xl font-bold">{summary?.referrals.level3 ?? 0}</p>
                <p className="text-xs text-muted-foreground">Level 3</p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Referral earnings</span>
                <span className="font-bold">{formatNumber(summary?.referrals.totalCommission)} XNRT</span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/referrals"><ExternalLink className="mr-2 h-4 w-4" /> Open Referrals</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Rewards Progress</CardTitle>
            <CardDescription>Tasks and achievements summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Tasks completed</span>
                <span>{summary?.tasks.completed ?? 0}/{summary?.tasks.totalActive ?? 0}</span>
              </div>
              <Progress value={summary?.tasks.progressPercent ?? 0} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Achievements unlocked</span>
                <span>{summary?.achievements.unlocked ?? 0}/{summary?.achievements.total ?? 0}</span>
              </div>
              <Progress value={summary?.achievements.progressPercent ?? 0} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link href="/tasks">Tasks</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/achievements">Achievements</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Account Status</CardTitle>
            <CardDescription>Security and daily activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-sm">Email verified</span>
              </div>
              <Badge variant={user?.emailVerified ? "default" : "destructive"}>{user?.emailVerified ? "Verified" : "Pending"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                <span className="text-sm">Daily check-in</span>
              </div>
              <Badge variant={summary?.checkin.checkedInToday ? "default" : "secondary"}>{summary?.checkin.checkedInToday ? "Done" : "Pending"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-sm">Last check-in</span>
              </div>
              <span className="text-sm font-medium">{formatDate(summary?.checkin.lastCheckIn)}</span>
            </div>
            <Button asChild className="w-full">
              <Link href="/rewards"><ExternalLink className="mr-2 h-4 w-4" /> Open Rewards</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle>
          <CardDescription>Your latest profile, earning, task, and reward events</CardDescription>
        </CardHeader>
        <CardContent>
          {summary?.recentActivities?.length ? (
            <div className="space-y-3">
              {summary.recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground capitalize">{activity.type.replace(/_/g, " ")}</p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              No recent activity yet. Complete tasks, check in, or start mining to build your profile history.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your public username, display name, and avatar image URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formState.username}
                onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="username"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={formState.firstName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={formState.lastName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileImageUrl">Profile image URL</Label>
              <Input
                id="profileImageUrl"
                value={formState.profileImageUrl}
                onChange={(event) => setFormState((prev) => ({ ...prev, profileImageUrl: event.target.value }))}
                placeholder="https://example.com/avatar.png"
              />
              <p className="text-xs text-muted-foreground">Use a secure image URL or leave blank to show initials.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateProfileMutation.isPending}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={() => updateProfileMutation.mutate(formState)} disabled={updateProfileMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
