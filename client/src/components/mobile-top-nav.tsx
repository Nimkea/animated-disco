import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gem,
  Pickaxe,
  MoreHorizontal,
  Users,
  TrendingUp,
  User,
  ListChecks,
  Trophy,
  Gift,
  MessageCircle,
  LogOut,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const primaryNavItems = [
  { title: "Home", url: "/", icon: Home, testId: "mobile-nav-home" },
  { title: "Wallet", url: "/wallet", icon: Wallet, testId: "mobile-nav-wallet" },
  { title: "Deposit", url: "/deposit", icon: ArrowDownToLine, testId: "mobile-nav-deposit" },
  { title: "Withdrawal", url: "/withdrawal", icon: ArrowUpFromLine, testId: "mobile-nav-withdrawal" },
  { title: "Staking", url: "/staking", icon: Gem, testId: "mobile-nav-staking" },
  { title: "Mining", url: "/mining", icon: Pickaxe, testId: "mobile-nav-mining" },
];

const moreNavItems = [
  { title: "Referrals", url: "/referrals", icon: Users, testId: "mobile-more-referrals" },
  { title: "Leaderboard", url: "/leaderboard", icon: TrendingUp, testId: "mobile-more-leaderboard" },
  { title: "Tasks", url: "/tasks", icon: ListChecks, testId: "mobile-more-tasks" },
  { title: "Achievements", url: "/achievements", icon: Trophy, testId: "mobile-more-achievements" },
  { title: "Rewards", url: "/rewards", icon: Gift, testId: "mobile-more-rewards" },
  { title: "Profile", url: "/profile", icon: User, testId: "mobile-more-profile" },
];

interface MobileTopNavProps {
  onChatOpen?: () => void;
}

export function MobileTopNav({ onChatOpen }: MobileTopNavProps) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Fixed Top Navigation Bar */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border"
        data-testid="mobile-top-nav"
      >
        <div className="flex items-center overflow-x-auto scrollbar-hide px-2 py-2 gap-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.url;
            
            return (
              <Link key={item.title} href={item.url}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[64px] h-14 px-2 rounded-lg transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  data-testid={item.testId}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-medium truncate max-w-full">
                    {item.title}
                  </span>
                </button>
              </Link>
            );
          })}
          
          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[64px] h-14 px-2 rounded-lg transition-all",
              "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            data-testid="mobile-nav-more"
          >
            <MoreHorizontal className="h-5 w-5 mb-1" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DrawerContent className="max-h-[80vh]" data-testid="mobile-more-drawer">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              More Options
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              Additional features and settings
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 space-y-2 overflow-y-auto">
            {/* Navigation Items */}
            {moreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.url;
              
              return (
                <Link key={item.title} href={item.url}>
                  <button
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                    data-testid={item.testId}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.title}</span>
                  </button>
                </Link>
              );
            })}

            {/* Chat Support */}
            <button
              onClick={() => {
                setIsMoreOpen(false);
                onChatOpen?.();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-all text-foreground hover:bg-accent"
              data-testid="mobile-more-chat"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Chat Support</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-all text-destructive hover:bg-destructive/10"
              data-testid="mobile-more-logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
