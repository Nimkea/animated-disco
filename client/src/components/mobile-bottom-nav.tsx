import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Wallet, Pickaxe, Gem, MoreHorizontal, ArrowDownToLine, ArrowUpFromLine, Users, TrendingUp, ListChecks, Trophy, Gift, User, MessageCircle, LogOut, HandCoins } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// Main bottom tabs (5 items)
const bottomTabs = [
  { title: "Home", url: "/", icon: Home, testId: "bottom-nav-home" },
  { title: "Wallet", url: "/wallet", icon: Wallet, testId: "bottom-nav-wallet" },
  { title: "Mining", url: "/mining", icon: Pickaxe, testId: "bottom-nav-mining" },
  { title: "Staking", url: "/staking", icon: Gem, testId: "bottom-nav-staking" },
  { title: "More", url: "#", icon: MoreHorizontal, testId: "bottom-nav-more", isDrawer: true },
];

// Grouped items in More drawer
const moreGroups = [
  {
    title: "Account",
    items: [
      { title: "Profile", url: "/profile", icon: User, testId: "more-profile" },
      { title: "Rewards", url: "/rewards", icon: Gift, testId: "more-rewards" },
      { title: "Trust Loan", url: "/trust-loan", icon: HandCoins, testId: "more-trust-loan" },
      { title: "Achievements", url: "/achievements", icon: Trophy, testId: "more-achievements" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { title: "Deposit", url: "/deposit", icon: ArrowDownToLine, testId: "more-deposit" },
      { title: "Withdrawal", url: "/withdrawal", icon: ArrowUpFromLine, testId: "more-withdrawal" },
    ],
  },
  {
    title: "Social",
    items: [
      { title: "Referrals", url: "/referrals", icon: Users, testId: "more-referrals" },
      { title: "Leaderboard", url: "/leaderboard", icon: TrendingUp, testId: "more-leaderboard" },
    ],
  },
  {
    title: "Tasks & Support",
    items: [
      { title: "Tasks", url: "/tasks", icon: ListChecks, testId: "more-tasks" },
      { title: "Chat Support", url: "#", icon: MessageCircle, testId: "more-chat-support", isAction: true as const, action: "chat" as const },
      { title: "Logout", url: "#", icon: LogOut, testId: "more-logout", isAction: true as const, action: "logout" as const },
    ],
  },
];

interface MobileBottomNavProps {
  onChatOpen?: () => void;
}

export function MobileBottomNav({ onChatOpen }: MobileBottomNavProps) {
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

  const isActiveTab = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border/50 safe-area-inset-bottom"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around px-2 py-2 max-w-screen-sm mx-auto">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = !tab.isDrawer && isActiveTab(tab.url);

            if (tab.isDrawer) {
              return (
                <button
                  key={tab.title}
                  onClick={() => setIsMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[60px] h-16 px-2 py-1.5 rounded-xl transition-all duration-200",
                    "hover:bg-primary/5 active:scale-95"
                  )}
                  data-testid={tab.testId}
                  aria-label={tab.title}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    {tab.title}
                  </span>
                </button>
              );
            }

            return (
              <Link key={tab.title} href={tab.url}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[60px] h-16 px-2 py-1.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                      : "text-muted-foreground hover:bg-primary/5 active:scale-95"
                  )}
                  data-testid={tab.testId}
                  aria-label={tab.title}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]")} />
                  <span className={cn("text-[10px] font-medium mt-0.5", isActive && "font-semibold")}>
                    {tab.title}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Drawer */}
      <Drawer open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DrawerContent className="max-h-[85vh] bg-background/98 backdrop-blur-xl border-border/50">
          <DrawerHeader className="border-b border-border/50 pb-4">
            <DrawerTitle className="text-lg font-semibold font-serif bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              More Options
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 py-6 space-y-6">
            {moreGroups.map((group, groupIndex) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = !item.isAction && isActiveTab(item.url);

                    // Handle special action items (Chat Support, Logout)
                    if (item.isAction) {
                      if (item.action === "chat" && !onChatOpen) {
                        return null; // Skip if no chat handler
                      }

                      const isLogout = item.action === "logout";

                      return (
                        <button
                          key={item.title}
                          onClick={() => {
                            setIsMoreOpen(false);
                            if (item.action === "chat" && onChatOpen) {
                              onChatOpen();
                            } else if (item.action === "logout") {
                              handleLogout();
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200",
                            isLogout
                              ? "text-destructive hover:bg-destructive/10 active:scale-[0.98]"
                              : "text-foreground hover:bg-muted/50 active:scale-[0.98]"
                          )}
                          data-testid={item.testId}
                        >
                          <div className={cn(
                            "grid h-10 w-10 place-items-center rounded-lg",
                            isLogout ? "bg-destructive/10" : "bg-muted/50"
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{item.title}</p>
                          </div>
                        </button>
                      );
                    }

                    // Regular navigation items
                    return (
                      <Link key={item.title} href={item.url}>
                        <button
                          onClick={() => setIsMoreOpen(false)}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200",
                            isActive
                              ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                              : "text-foreground hover:bg-muted/50 active:scale-[0.98]"
                          )}
                          data-testid={item.testId}
                        >
                          <div className={cn(
                            "grid h-10 w-10 place-items-center rounded-lg transition-colors",
                            isActive ? "bg-primary/20" : "bg-muted/50"
                          )}>
                            <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className={cn("font-medium", isActive && "text-primary")}>{item.title}</p>
                          </div>
                        </button>
                      </Link>
                    );
                  })}
                </div>
                {groupIndex < moreGroups.length - 1 && (
                  <Separator className="mt-6 bg-border/50" />
                )}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
