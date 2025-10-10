import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Coins,
  PieChart as PieChartIcon
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsData {
  dailyTransactions: {
    date: string;
    deposits: number;
    withdrawals: number;
    revenue: number;
  }[];
  userGrowth: {
    date: string;
    newUsers: number;
  }[];
  stakingTiers: {
    'Royal Sapphire': number;
    'Legendary Emerald': number;
    'Imperial Platinum': number;
    'Mythic Diamond': number;
  };
  referralStats: {
    totalCommissions: number;
    totalReferrals: number;
    activeReferrers: number;
  };
  totalRevenue: number;
  totalUsers: number;
  totalStakes: number;
}

const TIER_COLORS = {
  'Royal Sapphire': '#3b82f6',
  'Legendary Emerald': '#10b981',
  'Imperial Platinum': '#8b5cf6',
  'Mythic Diamond': '#f59e0b'
};

export default function AnalyticsTab() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No analytics data available
      </div>
    );
  }

  const stakingTierData = Object.entries(analytics.stakingTiers).map(([name, value]) => ({
    name,
    value,
    color: TIER_COLORS[name as keyof typeof TIER_COLORS]
  }));

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-analytics-revenue">
              {analytics.totalRevenue.toLocaleString()} XNRT
            </div>
            <p className="text-xs text-muted-foreground mt-1">From withdrawal fees (2%)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stakes</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-analytics-stakes">
              {analytics.totalStakes}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all tiers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-analytics-commissions">
              {analytics.referralStats.totalCommissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.referralStats.activeReferrers} active referrers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-analytics-users">
              {analytics.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Platform-wide</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Deposits vs Withdrawals */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume (30 Days)</CardTitle>
            <CardDescription>Daily deposits and withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.dailyTransactions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="deposits" 
                  stroke="#10b981" 
                  name="Deposits (XNRT)"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="withdrawals" 
                  stroke="#ef4444" 
                  name="Withdrawals (XNRT)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Growth */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth (30 Days)</CardTitle>
            <CardDescription>New user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Area 
                  type="monotone" 
                  dataKey="newUsers" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.6}
                  name="New Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Staking Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Staking Tier Distribution</CardTitle>
            <CardDescription>Active stakes by tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stakingTierData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stakingTierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue & Referral Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Performance</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Revenue (Fees)</span>
                <Badge variant="outline" className="text-base">
                  {analytics.totalRevenue.toLocaleString()} XNRT
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                2% fee on all withdrawals
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Referral Commissions Paid</span>
                <Badge variant="outline" className="text-base">
                  {analytics.referralStats.totalCommissions.toLocaleString()} XNRT
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {analytics.referralStats.totalReferrals} total commissions · {analytics.referralStats.activeReferrers} active referrers
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Stakes</span>
                <Badge variant="outline" className="text-base">
                  {analytics.totalStakes}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Across {Object.keys(analytics.stakingTiers).length} staking tiers
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">User Base</span>
                <Badge variant="outline" className="text-base">
                  {analytics.totalUsers}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Total registered users
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
