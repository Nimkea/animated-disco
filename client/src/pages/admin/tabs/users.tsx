import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search,
  Filter,
  Crown,
  TrendingUp,
  Users as UsersIcon,
  Calendar,
  Wallet
} from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserData {
  id: string;
  email: string;
  username: string;
  referralCode: string;
  isAdmin: boolean;
  xp: number;
  level: number;
  streak: number;
  createdAt: string;
  balance: {
    xnrtBalance: string;
    stakingBalance: string;
    miningBalance: string;
    referralBalance: string;
    totalEarned: string;
  } | null;
  stats: {
    activeStakes: number;
    totalStaked: string;
    referralsCount: number;
    depositCount: number;
    withdrawalCount: number;
  };
}

export default function UsersTab() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  const filteredUsers = users?.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      user.referralCode.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  const getTotalBalance = (user: UserData) => {
    if (!user.balance) return 0;
    return (
      parseFloat(user.balance.xnrtBalance) +
      parseFloat(user.balance.stakingBalance) +
      parseFloat(user.balance.miningBalance) +
      parseFloat(user.balance.referralBalance)
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, username, referral code, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Badge variant="outline" className="px-4 py-2">
          {filteredUsers?.length || 0} users
        </Badge>
      </div>

      {/* User Statistics Cards */}
      {users && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users-total">
                {users.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users-admin">
                {users.filter(u => u.isAdmin).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Stakers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users-stakers">
                {users.filter(u => u.stats.activeStakes > 0).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balances</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users-balance">
                {users.reduce((sum, u) => sum + getTotalBalance(u), 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">XNRT</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage all platform users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Balances</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.username}</span>
                            {user.isAdmin && (
                              <Badge variant="default" className="gap-1">
                                <Crown className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Ref: {user.referralCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Main:</span>
                            <span className="font-medium">
                              {parseFloat(user.balance?.xnrtBalance || "0").toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Staking:</span>
                            <span className="font-medium">
                              {parseFloat(user.balance?.stakingBalance || "0").toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Mining:</span>
                            <span className="font-medium">
                              {parseFloat(user.balance?.miningBalance || "0").toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Referral:</span>
                            <span className="font-medium">
                              {parseFloat(user.balance?.referralBalance || "0").toLocaleString()}
                            </span>
                          </div>
                          <div className="pt-1 border-t border-border flex justify-between gap-4">
                            <span className="text-muted-foreground font-semibold">Total:</span>
                            <span className="font-bold">
                              {getTotalBalance(user).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Lvl {user.level}</Badge>
                            <Badge variant="outline">{user.xp} XP</Badge>
                          </div>
                          <div className="text-muted-foreground">
                            🔥 {user.streak} day streak
                          </div>
                          <div className="text-muted-foreground">
                            {user.stats.activeStakes} active stakes
                          </div>
                          <div className="text-muted-foreground">
                            {user.stats.referralsCount} referrals
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>↓ {user.stats.depositCount} deposits</div>
                          <div>↑ {user.stats.withdrawalCount} withdrawals</div>
                          <div>
                            Earned: {parseFloat(user.balance?.totalEarned || "0").toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No users match your search" : "No users found"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
