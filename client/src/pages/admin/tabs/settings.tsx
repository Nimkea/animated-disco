import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  Database, 
  Settings as SettingsIcon,
  Activity,
  Shield,
  Clock,
  TrendingUp
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ActivityLog {
  id: string;
  userId: string;
  type: string;
  description: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  };
}

interface PlatformInfo {
  platform: {
    name: string;
    version: string;
    environment: string;
  };
  statistics: {
    totalUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalStakes: number;
    totalActivities: number;
  };
  configuration: {
    stakingTiers: {
      name: string;
      min: number;
      max: number;
      apy: number;
      duration: number;
    }[];
    depositRate: number;
    withdrawalFee: number;
    companyWallet: string;
  };
}

export default function SettingsTab() {
  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/admin/activities"],
  });

  const { data: platformInfo, isLoading: infoLoading } = useQuery<PlatformInfo>({
    queryKey: ["/api/admin/info"],
  });

  const getActivityColor = (type: string) => {
    if (type.includes('approved')) return 'default';
    if (type.includes('rejected')) return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Platform Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {infoLoading ? (
              <div className="animate-pulse h-8 bg-muted rounded"></div>
            ) : platformInfo ? (
              <div>
                <div className="text-2xl font-bold" data-testid="platform-name">
                  {platformInfo.platform.name}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  v{platformInfo.platform.version} ({platformInfo.platform.environment})
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {infoLoading ? (
              <div className="animate-pulse h-8 bg-muted rounded"></div>
            ) : platformInfo ? (
              <div>
                <div className="text-2xl font-bold" data-testid="total-records">
                  {(platformInfo.statistics.totalUsers + 
                    platformInfo.statistics.totalDeposits + 
                    platformInfo.statistics.totalWithdrawals + 
                    platformInfo.statistics.totalStakes).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total records
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {infoLoading ? (
              <div className="animate-pulse h-8 bg-muted rounded"></div>
            ) : platformInfo ? (
              <div>
                <div className="text-2xl font-bold" data-testid="total-activities">
                  {platformInfo.statistics.totalActivities.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All-time events
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Staking Tiers */}
        <Card>
          <CardHeader>
            <CardTitle>Staking Tiers Configuration</CardTitle>
            <CardDescription>Current staking tier settings</CardDescription>
          </CardHeader>
          <CardContent>
            {infoLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-muted rounded"></div>
                ))}
              </div>
            ) : platformInfo ? (
              <div className="space-y-3">
                {platformInfo.configuration.stakingTiers.map((tier) => (
                  <div key={tier.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {tier.min.toLocaleString()} - {tier.max === null ? '∞' : tier.max.toLocaleString()} XNRT
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{tier.apy}% APY</div>
                      <div className="text-sm text-muted-foreground">{tier.duration} days</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Platform Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Configuration</CardTitle>
            <CardDescription>System parameters and settings</CardDescription>
          </CardHeader>
          <CardContent>
            {infoLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-muted rounded"></div>
                ))}
              </div>
            ) : platformInfo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">Deposit Rate</div>
                    <div className="text-sm text-muted-foreground">USDT to XNRT conversion</div>
                  </div>
                  <Badge variant="outline" className="text-base">
                    1:{platformInfo.configuration.depositRate}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">Withdrawal Fee</div>
                    <div className="text-sm text-muted-foreground">Platform fee on withdrawals</div>
                  </div>
                  <Badge variant="outline" className="text-base">
                    {platformInfo.configuration.withdrawalFee}%
                  </Badge>
                </div>

                <div className="p-3 rounded-lg border">
                  <div className="font-medium mb-2">XNRT Wallet</div>
                  <div className="text-sm font-mono text-muted-foreground break-all">
                    {platformInfo.configuration.companyWallet}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    BEP20 (Binance Smart Chain)
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Admin Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Activity Audit Log</CardTitle>
          <CardDescription>
            Recent admin actions and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id} data-testid={`activity-row-${activity.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {activity.user.username}
                            {activity.user.isAdmin && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {activity.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActivityColor(activity.type)}>
                          {activity.type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{activity.description}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No admin activities recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
