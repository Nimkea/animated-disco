import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Users, 
  BarChart3, 
  Settings,
  TrendingUp,
  ListChecks,
  Award,
  Megaphone,
  ShieldCheck,
  Radar,
  BellRing,
  HandCoins,
  Gamepad2,
  GraduationCap
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import OverviewTab from "./tabs/overview";
import DepositsTab from "./tabs/deposits";
import WithdrawalsTab from "./tabs/withdrawals";
import UsersTab from "./tabs/users";
import AnalyticsTab from "./tabs/analytics";
import SettingsTab from "./tabs/settings";
import StakesTab from "./tabs/stakes";
import TasksTab from "./tabs/tasks";
import AchievementsTab from "./tabs/achievements";
import AnnouncementsTab from "./tabs/announcements";
import AuditLogsTab from "./tabs/audit-logs";
import ScannerDashboardTab from "./tabs/scanner-dashboard";
import NotificationBroadcastTab from "./tabs/notification-broadcast";
import TrustLoanConfigTab from "./tabs/trust-loan-config";
import EngagementConfigTab from "./tabs/engagement-config";
import LearnEarnTab from "./tabs/learn-earn";

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Parse query string to get active tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["overview", "deposits", "withdrawals", "users", "analytics", "settings", "stakes", "tasks", "achievements", "announcements", "audit", "scanner", "broadcast", "trust-loan", "engagement", "learn"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/admin?tab=${value}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Manage platform operations and monitor activity</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/70 p-1 lg:w-auto">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="deposits" className="gap-2" data-testid="tab-deposits">
            <ArrowDownCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Deposits</span>
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2" data-testid="tab-withdrawals">
            <ArrowUpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Withdrawals</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="stakes" className="gap-2" data-testid="tab-stakes">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Stakes</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2" data-testid="tab-achievements">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Achievements</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2" data-testid="tab-announcements">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Announcements</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-2" data-testid="tab-scanner">
            <Radar className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-2" data-testid="tab-broadcast">
            <BellRing className="h-4 w-4" />
            <span className="hidden sm:inline">Broadcast</span>
          </TabsTrigger>
          <TabsTrigger value="trust-loan" className="gap-2" data-testid="tab-trust-loan">
            <HandCoins className="h-4 w-4" />
            <span className="hidden sm:inline">Trust Loan</span>
          </TabsTrigger>
          <TabsTrigger value="engagement" className="gap-2" data-testid="tab-engagement">
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden sm:inline">Engagement</span>
          </TabsTrigger>
          <TabsTrigger value="learn" className="gap-2" data-testid="tab-learn">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Learn</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="deposits" className="space-y-6">
          <DepositsTab />
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <WithdrawalsTab />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UsersTab />
        </TabsContent>

        <TabsContent value="stakes" className="space-y-6">
          <StakesTab />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <TasksTab />
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <AchievementsTab />
        </TabsContent>

        <TabsContent value="announcements" className="space-y-6">
          <AnnouncementsTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsTab />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <AuditLogsTab />
        </TabsContent>

        <TabsContent value="scanner" className="space-y-6">
          <ScannerDashboardTab />
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-6">
          <NotificationBroadcastTab />
        </TabsContent>

        <TabsContent value="trust-loan" className="space-y-6">
          <TrustLoanConfigTab />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <EngagementConfigTab />
        </TabsContent>

        <TabsContent value="learn" className="space-y-6">
          <LearnEarnTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
