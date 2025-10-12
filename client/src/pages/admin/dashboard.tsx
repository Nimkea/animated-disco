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
  Layers
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
import StakingTiersTab from "./tabs/staking-tiers";

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Parse query string to get active tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["overview", "deposits", "withdrawals", "users", "analytics", "settings", "stakes", "staking-tiers", "tasks", "achievements"].includes(tab)) {
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
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-10 lg:w-auto lg:inline-grid">
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
          <TabsTrigger value="staking-tiers" className="gap-2" data-testid="tab-staking-tiers">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Tiers</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2" data-testid="tab-achievements">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Achievements</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
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

        <TabsContent value="staking-tiers" className="space-y-6">
          <StakingTiersTab />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <TasksTab />
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <AchievementsTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
