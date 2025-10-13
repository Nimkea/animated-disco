import { Switch, Route, useLocation } from "wouter";
import { queryClient, initCSRFToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { PWAUpdateNotification } from "@/components/pwa-update-notification";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChatBot } from "@/components/chat-bot";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationBadge } from "@/hooks/use-notification-badge";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Auth from "@/pages/auth/auth";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";
import VerifyEmail from "@/pages/auth/verify-email";
import Home from "@/pages/home";
import Wallet from "@/pages/wallet";
import Deposit from "@/pages/deposit";
import Withdrawal from "@/pages/withdrawal";
import Staking from "@/pages/staking";
import Mining from "@/pages/mining";
import Referrals from "@/pages/referrals";
import Profile from "@/pages/profile";
import Tasks from "@/pages/tasks";
import Achievements from "@/pages/achievements";
import Rewards from "@/pages/rewards";
import Leaderboard from "@/pages/leaderboard";
import AdminDashboard from "@/pages/admin/dashboard";

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Enable notification badge on app icon
  useNotificationBadge();

  return (
    <SidebarProvider style={style as React.CSSProperties} defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Welcome to <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">XNRT</span>
              </div>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
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
                <Route path="/admin" component={AdminDashboard} />
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <ChatBot />
    </SidebarProvider>
  );
}

function UnauthenticatedApp() {
  const [location] = useLocation();
  
  // Show chatbot only on landing page, not on auth pages
  const showChatBot = location === "/";
  
  return (
    <>
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
    </>
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
      <TooltipProvider>
        <AppContent />
        <Toaster />
        <PWAInstallPrompt />
        <PWAUpdateNotification />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
