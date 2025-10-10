import {
  Home,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gem,
  Pickaxe,
  Users,
  User,
  ListChecks,
  Trophy,
  Gift,
  LogOut,
  Sparkles,
  Shield,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";

const menuItems = [
  { title: "Home", url: "/", icon: Home, testId: "nav-home" },
  { title: "Wallet", url: "/wallet", icon: Wallet, testId: "nav-wallet" },
  { title: "Deposit", url: "/deposit", icon: ArrowDownToLine, testId: "nav-deposit" },
  { title: "Withdrawal", url: "/withdrawal", icon: ArrowUpFromLine, testId: "nav-withdrawal" },
  { title: "Staking", url: "/staking", icon: Gem, testId: "nav-staking" },
  { title: "Mining", url: "/mining", icon: Pickaxe, testId: "nav-mining" },
  { title: "Referrals", url: "/referrals", icon: Users, testId: "nav-referrals" },
  { title: "Profile", url: "/profile", icon: User, testId: "nav-profile" },
  { title: "Tasks", url: "/tasks", icon: ListChecks, testId: "nav-tasks" },
  { title: "Achievements", url: "/achievements", icon: Trophy, testId: "nav-achievements" },
  { title: "Rewards", url: "/rewards", icon: Gift, testId: "nav-rewards" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useQuery<UserType>({
    queryKey: ["/auth/me"],
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              XNRT
            </h2>
            <p className="text-xs text-muted-foreground">NextGen Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-4">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={location === item.url ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground px-4">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={location === "/admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                    data-testid="nav-admin"
                  >
                    <Link href="/admin">
                      <Shield className="h-5 w-5" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={async () => {
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
          }}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
