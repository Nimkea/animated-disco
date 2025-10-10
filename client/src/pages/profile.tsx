import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Award, Flame, Users, Calendar, TrendingUp } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { format } from "date-fns";

interface ProfileStats {
  totalReferrals: number;
  activeStakes: number;
  totalStaked: number;
  miningSessions: number;
  totalMined: number;
  referralEarnings: number;
  tasksCompleted: number;
  achievementsUnlocked: number;
}

export default function Profile() {
  const { data: user } = useQuery<UserType>({
    queryKey: ["/auth/me"],
  });

  const { data: stats } = useQuery<ProfileStats>({
    queryKey: ["/api/profile/stats"],
  });

  if (!user) return null;

  const initials = user.username?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Profile</h1>
        <p className="text-muted-foreground">Your account information and statistics</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={user.profileImageUrl || ""} alt={user.username || ""} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold font-serif" data-testid="text-username">{user.username}</h2>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-email">{user.email}</p>
              <Badge variant="outline" className="gap-2 px-4 py-2">
                <Award className="h-4 w-4 text-primary" />
                <span>Level {user.level}</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Statistics</CardTitle>
            <CardDescription>Your XNRT platform journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>Experience Points</span>
                </div>
                <p className="text-3xl font-bold font-mono" data-testid="text-xp">{user.xp?.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4" />
                  <span>Current Streak</span>
                </div>
                <p className="text-3xl font-bold font-mono" data-testid="text-streak">{user.streak} days</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Referrals</span>
                </div>
                <p className="text-3xl font-bold font-mono">{stats?.totalReferrals || 0}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Member Since</span>
                </div>
                <p className="text-xl font-semibold">
                  {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">Referral Information</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Referral Code:</span>
                  <code className="px-3 py-1 bg-muted rounded-md font-mono font-bold" data-testid="text-referral-code">
                    {user.referralCode}
                  </code>
                </div>
                {user.referredBy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Referred By:</span>
                    <code className="px-3 py-1 bg-muted rounded-md font-mono">{user.referredBy}</code>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Earning Summary</CardTitle>
          <CardDescription>Your performance across all earning methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Active Stakes</span>
              </div>
              <p className="text-2xl font-bold">{stats?.activeStakes || 0}</p>
              <p className="text-xs text-muted-foreground">
                Total Staked: {stats?.totalStaked?.toLocaleString() || 0} XNRT
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Mining Sessions</span>
              </div>
              <p className="text-2xl font-bold">{stats?.miningSessions || 0}</p>
              <p className="text-xs text-muted-foreground">
                Total Mined: {stats?.totalMined?.toLocaleString() || 0} XP
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Referral Earnings</span>
              </div>
              <p className="text-2xl font-bold">{stats?.referralEarnings?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground">XNRT from referrals</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Tasks Completed</span>
              </div>
              <p className="text-2xl font-bold">{stats?.tasksCompleted || 0}</p>
              <p className="text-xs text-muted-foreground">
                Achievements: {stats?.achievementsUnlocked || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
