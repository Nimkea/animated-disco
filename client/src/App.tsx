import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient, initCSRFToken } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { PWAUpdateNotification } from "@/components/pwa-update-notification";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChatBot } from "@/components/chat-bot";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationBadge } from "@/hooks/use-notification-badge";

// Eager (lightweight) pages - only auth and landing
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Auth from "@/pages/auth/auth";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";
import VerifyEmail from "@/pages/auth/verify-email";

// Lazy load all authenticated pages for faster initial load
const HomePage = lazy(() => import("@/pages/home"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const DepositPage = lazy(() => import("@/pages/deposit"));
const WithdrawalPage = lazy(() => import("@/pages/withdrawal"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const RewardsPage = lazy(() => import("@/pages/rewards"));
const StakingPage = lazy(() => import("@/pages/staking"));
const MiningPage = lazy(() => import("@/pages/mining"));
const ReferralsPage = lazy(() => import("@/pages/referrals"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));

// Create Suspense wrappers for lazy-loaded pages
const Home = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <HomePage />
  </Suspense>
);

const Wallet = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <WalletPage />
  </Suspense>
);

const Deposit = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <DepositPage />
  </Suspense>
);

const Withdrawal = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <WithdrawalPage />
  </Suspense>
);

const Profile = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <ProfilePage />
  </Suspense>
);

const Tasks = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <TasksPage />
  </Suspense>
);

const Achievements = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <AchievementsPage />
  </Suspense>
);

const Rewards = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <RewardsPage />
  </Suspense>
);

const Staking = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <StakingPage />
  </Suspense>
);

const Mining = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <MiningPage />
  </Suspense>
);

const Referrals = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <ReferralsPage />
  </Suspense>
);

const Leaderboard = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>}>
    <LeaderboardPage />
  </Suspense>
);

/** Admin-protected Dashboard component */
function ProtectedAdminDashboard() {
  const { user, isLoading } = useAuth();
  
  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Checking permissions...</div>
      </div>
    );
  }
  
  // Check admin status  
  if (!(user as any)?.isAdmin) {
    return <Redirect to="/" />;
  }
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading…
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}

function AuthenticatedApp() {
  const style: React.CSSProperties = {
    ["--sidebar-width" as any]: "16rem",
    ["--sidebar-width-icon" as any]: "3rem",
  };

  // Enable notification badge on app icon
  useNotificationBadge();

  // Chat bot state
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <SidebarProvider style={style} defaultOpen={true}>
      <MobileBottomNav onChatOpen={() => setIsChatOpen(true)} />
      <div className="flex h-screen w-full">
        <AppSidebar onChatOpen={() => setIsChatOpen(true)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="md:flex hidden items-center justify-between p-4 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Welcome to{" "}
                <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  XNRT
                </span>
              </div>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 pb-24 md:pb-6 bg-background">
            <ErrorBoundary>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/wallet" component={Wallet} />
                <Route path="/deposit" component={Deposit} />
                <Route path="/withdrawal" component={Withdrawal} />
                <Route path="/staking" component={Staking} />
                <Route path="/mining" component={Mining} />
                <Route path="/referrals" component={Referrals} />
                <Route path="/profile" component={Profile} />
                <Route path="/tasks" component={Tasks} />
                <Route path="/achievements" component={Achievements} />
                <Route path="/rewards" component={Rewards} />
                <Route path="/leaderboard" component={Leaderboard} />
                <Route path="/admin" component={ProtectedAdminDashboard} />
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <ChatBot
        isOpen={isChatOpen}
        onOpenChange={setIsChatOpen}
        showLauncher={false}
      />
    </SidebarProvider>
  );
}

function UnauthenticatedApp() {
  const [location] = useLocation();
  const showChatBot = location === "/";

  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={Auth} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route component={Landing} />
      </Switch>
      {showChatBot && <ChatBot />}
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Initialize CSRF token on mount
  useEffect(() => {
    initCSRFToken();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <UnauthenticatedApp />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Note: TooltipProvider is provided by SidebarProvider in AuthenticatedApp */}
      {/* Do NOT add a TooltipProvider here - it will cause nested provider conflicts */}
      <AppContent />
      <Toaster />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
    </QueryClientProvider>
  );
}
