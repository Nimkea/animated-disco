import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowDown } from "lucide-react";
import type { Referral } from "@shared/schema";

interface ReferralTreeProps {
  referrals: Referral[];
  isLoading?: boolean;
}

export function ReferralTree({ referrals, isLoading }: ReferralTreeProps) {
  const level1Referrals = referrals.filter(r => r.level === 1);
  const level2Referrals = referrals.filter(r => r.level === 2);
  const level3Referrals = referrals.filter(r => r.level === 3);

  if (isLoading) {
    return (
      <Card data-testid="card-referral-tree">
        <CardHeader>
          <CardTitle>Referral Network Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading referral network...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (referrals.length === 0) {
    return (
      <Card data-testid="card-referral-tree">
        <CardHeader>
          <CardTitle>Referral Network</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No referrals yet. Start sharing your code!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-referral-tree">
      <CardHeader>
        <CardTitle>Referral Network Tree</CardTitle>
        <p className="text-sm text-muted-foreground">Visualize your 3-level referral structure</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* You (Root) */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="px-6 py-3 bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-bold">You</span>
              </div>
            </div>
            {level1Referrals.length > 0 && (
              <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
                <ArrowDown className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Level 1 */}
        {level1Referrals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="bg-chart-1/20 text-chart-1 border-chart-1/30">
                Level 1 - 6% Commission
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {level1Referrals.slice(0, 8).map((ref, idx) => (
                <div key={ref.id} className="p-3 bg-chart-1/5 border border-chart-1/20 rounded-md text-center" data-testid={`tree-node-l1-${idx}`}>
                  <Users className="h-4 w-4 mx-auto mb-1 text-chart-1" />
                  <p className="text-xs font-medium truncate">Referral #{idx + 1}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(ref.totalCommission).toFixed(2)} XNRT</p>
                </div>
              ))}
              {level1Referrals.length > 8 && (
                <div className="p-3 bg-muted/50 border border-border rounded-md text-center flex items-center justify-center">
                  <p className="text-xs font-medium text-muted-foreground">+{level1Referrals.length - 8} more</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Level 2 */}
        {level2Referrals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">
                Level 2 - 3% Commission
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {level2Referrals.slice(0, 8).map((ref, idx) => (
                <div key={ref.id} className="p-3 bg-chart-2/5 border border-chart-2/20 rounded-md text-center" data-testid={`tree-node-l2-${idx}`}>
                  <Users className="h-4 w-4 mx-auto mb-1 text-chart-2" />
                  <p className="text-xs font-medium truncate">Referral #{idx + 1}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(ref.totalCommission).toFixed(2)} XNRT</p>
                </div>
              ))}
              {level2Referrals.length > 8 && (
                <div className="p-3 bg-muted/50 border border-border rounded-md text-center flex items-center justify-center">
                  <p className="text-xs font-medium text-muted-foreground">+{level2Referrals.length - 8} more</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Level 3 */}
        {level3Referrals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
                Level 3 - 1% Commission
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {level3Referrals.slice(0, 8).map((ref, idx) => (
                <div key={ref.id} className="p-3 bg-chart-3/5 border border-chart-3/20 rounded-md text-center" data-testid={`tree-node-l3-${idx}`}>
                  <Users className="h-4 w-4 mx-auto mb-1 text-chart-3" />
                  <p className="text-xs font-medium truncate">Referral #{idx + 1}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(ref.totalCommission).toFixed(2)} XNRT</p>
                </div>
              ))}
              {level3Referrals.length > 8 && (
                <div className="p-3 bg-muted/50 border border-border rounded-md text-center flex items-center justify-center">
                  <p className="text-xs font-medium text-muted-foreground">+{level3Referrals.length - 8} more</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
