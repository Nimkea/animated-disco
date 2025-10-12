import { XPLeaderboard } from "@/components/xp-leaderboard";
import { ReferralLeaderboard } from "@/components/referral-leaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users } from "lucide-react";

export default function Leaderboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Leaderboards</h1>
        <p className="text-muted-foreground">See how you rank against other users</p>
      </div>

      <Tabs defaultValue="xp" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="xp" className="flex items-center gap-2" data-testid="tab-xp">
            <Trophy className="h-4 w-4" />
            XP Rankings
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2" data-testid="tab-referrals">
            <Users className="h-4 w-4" />
            Referral Rankings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="xp" className="mt-6">
          <XPLeaderboard />
        </TabsContent>
        
        <TabsContent value="referrals" className="mt-6">
          <ReferralLeaderboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
