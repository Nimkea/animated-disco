import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Share2, DollarSign, QrCode, History, CheckCircle2 } from "lucide-react";
import { SiWhatsapp, SiTelegram, SiX } from "react-icons/si";
import { ReferralTree } from "@/components/referral-tree";
import { ReferralLeaderboard } from "@/components/referral-leaderboard";
import { SkeletonReferralTree } from "@/components/skeletons";
import { useAuth } from "@/hooks/useAuth";
import type { Referral } from "@shared/schema";

interface ReferralStats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  level1Commission: string;
  level2Commission: string;
  level3Commission: string;
  totalCommission: string;
  paidNetworkCommission?: string;
  actualBalance: string;
  companyCommissions: string;
  ledgerBacked?: boolean;
}

interface ReferralCommissionItem {
  id: string;
  transactionId: string;
  referredUserId: string;
  referredDisplayName?: string;
  level: number;
  baseAmount: string;
  rate: string;
  commission: string;
  status: string;
  createdAt: string | Date;
}

export default function Referrals() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { user } = useAuth();

  const { data: referralStats } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
  });

  const { data: referralTree, isLoading: isLoadingTree } = useQuery<Referral[]>({
    queryKey: ["/api/referrals/tree"],
  });

  const { data: commissionHistory, isLoading: isLoadingCommissions } = useQuery<ReferralCommissionItem[]>({
    queryKey: ["/api/referrals/commissions"],
  });

  const referralCode = (user?.referralCode || "").trim().toUpperCase();
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join XNRT Platform",
        text: `Use my referral code ${referralCode} to join XNRT and start earning!`,
        url: referralLink,
      });
    } else {
      copyToClipboard(referralLink);
    }
  };

  const shareMessage = `Join XNRT and start earning! Use my referral code ${referralCode} to get started: ${referralLink}`;

  const formatXnrt = (value?: string | null) =>
    parseFloat(value || "0").toLocaleString(undefined, { maximumFractionDigits: 2 });

  const formatRate = (value?: string | null) =>
    `${(parseFloat(value || "0") * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
  };

  const shareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`Join XNRT with my referral code ${referralCode}!`)}`;
    window.open(url, '_blank');
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
  };

  const openQRDialog = () => {
    setShowQR(true);
  };

  // Generate QR code when dialog opens
  useEffect(() => {
    if (showQR && qrCanvasRef.current && referralLink) {
      // Use requestAnimationFrame to ensure canvas is in DOM
      requestAnimationFrame(async () => {
        try {
          await QRCode.toCanvas(qrCanvasRef.current!, referralLink, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
        } catch (error) {
          console.error('Error generating QR code:', error);
          toast({
            title: "Error",
            description: "Failed to generate QR code",
            variant: "destructive",
          });
        }
      });
    }
  }, [showQR, referralLink, toast]);

  const downloadQRCode = () => {
    if (qrCanvasRef.current) {
      const url = qrCanvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `xnrt-referral-${referralCode}.png`;
      link.href = url;
      link.click();
      toast({
        title: "Downloaded!",
        description: "QR code saved successfully",
      });
    }
  };

  const messageTemplates = [
    {
      title: "Quick Invite",
      message: `Hey! 👋 Join me on XNRT - an awesome platform to earn crypto tokens! Use my code ${referralCode} to get started: ${referralLink}`,
    },
    {
      title: "Detailed Pitch",
      message: `I've been earning on XNRT through staking, mining, and tasks. You can do the same! 💎 Join with my referral code ${referralCode} and start your earning journey: ${referralLink}`,
    },
    {
      title: "Professional",
      message: `I'm inviting you to XNRT - a comprehensive crypto earning platform with staking (up to 15% APY), mining, and referral rewards. Use code ${referralCode} to register: ${referralLink}`,
    },
  ];

  const copyTemplate = (message: string, title: string) => {
    navigator.clipboard.writeText(message);
    toast({
      title: "Template Copied!",
      description: `"${title}" message copied to clipboard`,
    });
  };

  const levelStats = [
    {
      level: 1,
      count: referralStats?.level1Count || 0,
      commission: referralStats?.level1Commission || "0",
      rate: "6%",
      color: "text-chart-1",
      title: "Level 1",
      description: "Direct referrals",
    },
    {
      level: 2,
      count: referralStats?.level2Count || 0,
      commission: referralStats?.level2Commission || "0",
      rate: "3%",
      color: "text-chart-2",
      title: "Level 2",
      description: "Indirect referrals",
    },
    {
      level: 3,
      count: referralStats?.level3Count || 0,
      commission: referralStats?.level3Commission || "0",
      rate: "1%",
      color: "text-chart-3",
      title: "Level 3",
      description: "Indirect referrals",
    },
    {
      level: 0,
      count: 0,
      commission: referralStats?.companyCommissions || "0",
      rate: "Varies",
      color: "text-primary",
      title: "Company",
      description: "Fallback commissions",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Referral Program</h1>
        <p className="text-muted-foreground">Invite friends and earn 3-level commissions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle>Your Referral Code</CardTitle>
            <CardDescription>Share this code to earn commissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={referralCode}
                readOnly
                className="font-mono text-lg font-bold"
                data-testid="input-referral-code"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(referralCode)}
                data-testid="button-copy-code"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm"
                data-testid="input-referral-link"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(referralLink)}
                data-testid="button-copy-link"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={shareReferral}
              data-testid="button-share"
            >
              <Share2 className="mr-2 h-5 w-5" />
              Share Referral Link
            </Button>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button
                variant="outline"
                onClick={shareWhatsApp}
                data-testid="button-share-whatsapp"
                className="hover-elevate"
              >
                <SiWhatsapp className="h-5 w-5 text-green-500" />
              </Button>
              <Button
                variant="outline"
                onClick={shareTelegram}
                data-testid="button-share-telegram"
                className="hover-elevate"
              >
                <SiTelegram className="h-5 w-5 text-blue-500" />
              </Button>
              <Button
                variant="outline"
                onClick={shareTwitter}
                data-testid="button-share-twitter"
                className="hover-elevate"
              >
                <SiX className="h-5 w-5" />
              </Button>
            </div>

            <Button
              className="w-full mt-2"
              variant="outline"
              onClick={openQRDialog}
              data-testid="button-generate-qr"
            >
              <QrCode className="mr-2 h-5 w-5" />
              Generate QR Code
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Commission Balance</CardTitle>
            <CardDescription>Withdrawable earnings from all sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <DollarSign className="h-8 w-8 text-chart-2" />
              <span className="text-5xl font-bold font-mono text-chart-2" data-testid="text-total-commission">
                {formatXnrt(referralStats?.actualBalance || "0")}
              </span>
              <span className="text-2xl text-muted-foreground">XNRT</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Referrals:</span>
                <span className="font-bold" data-testid="text-total-referrals">
                  {(referralStats?.level1Count || 0) + (referralStats?.level2Count || 0) + (referralStats?.level3Count || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ledger-backed Commissions:</span>
                <span className="font-bold">
                  {formatXnrt(referralStats?.totalCommission || "0")} XNRT
                </span>
              </div>
              {user?.isAdmin && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Company Commissions:</span>
                  <span className="font-bold">
                    {formatXnrt(referralStats?.companyCommissions || "0")} XNRT
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {levelStats.filter(stat => user?.isAdmin || stat.level > 0).map((stat, index) => (
          <Card key={index} className="hover-elevate">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{stat.title}</CardTitle>
                <Badge variant="secondary" className="font-mono">{stat.rate}</Badge>
              </div>
              <CardDescription>
                {stat.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stat.level > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Count:</span>
                  <span className="text-2xl font-bold" data-testid={`stat-level${stat.level}-count`}>
                    {stat.count}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Earned:</span>
                <span className={`text-xl font-bold ${stat.color}`} data-testid={`stat-level${stat.level}-commission`}>
                  {formatXnrt(stat.commission)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission Structure</CardTitle>
          <CardDescription>How you earn from referrals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 border border-chart-1/20 bg-chart-1/5 rounded-md">
              <div className="w-8 h-8 rounded-md bg-chart-1 text-white flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">Level 1 - Direct Referrals</p>
                  <Badge variant="secondary">6%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Earn 6% commission from deposits made by users you directly refer
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-chart-2/20 bg-chart-2/5 rounded-md">
              <div className="w-8 h-8 rounded-md bg-chart-2 text-white flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">Level 2 - Indirect Referrals</p>
                  <Badge variant="secondary">3%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Earn 3% commission from deposits made by referrals of your referrals
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-chart-3/20 bg-chart-3/5 rounded-md">
              <div className="w-8 h-8 rounded-md bg-chart-3 text-white flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">Level 3 - Indirect Referrals</p>
                  <Badge variant="secondary">1%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Earn 1% commission from third-level referral deposits
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>Pre-written messages to share with friends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {messageTemplates.map((template, index) => (
              <div
                key={index}
                className="p-4 border border-border rounded-md space-y-3"
                data-testid={`template-${index}`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{template.title}</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyTemplate(template.message, template.title)}
                    data-testid={`button-copy-template-${index}`}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{template.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>Your latest referral activity</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTree ? (
            <SkeletonReferralTree />
          ) : !referralTree || referralTree.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No referrals yet</p>
              <p className="text-sm text-muted-foreground mt-2">Share your referral code to start earning</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralTree.slice(0, 10).map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
                  data-testid={`referral-${referral.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
                      referral.level === 1 ? "bg-chart-1/20 text-chart-1" :
                      referral.level === 2 ? "bg-chart-2/20 text-chart-2" :
                      "bg-chart-3/20 text-chart-3"
                    }`}>
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{referral.displayName || `Level ${referral.level} Referral`}</p>
                        <Badge variant="secondary">L{referral.level}</Badge>
                        {referral.hasDeposited && (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Joined {referral.joinedAt ? new Date(referral.joinedAt).toLocaleDateString() : referral.createdAt ? new Date(referral.createdAt).toLocaleDateString() : 'N/A'}
                        {referral.hasDeposited ? ` • ${referral.depositCount || 0} approved deposit${(referral.depositCount || 0) === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-chart-2">
                      {formatXnrt(referral.totalCommission)} XNRT
                    </div>
                    <p className="text-xs text-muted-foreground">earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Commission Ledger
          </CardTitle>
          <CardDescription>Paid referral commissions, protected against duplicate payout per deposit.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCommissions ? (
            <div className="py-8 text-center text-muted-foreground">Loading commission history...</div>
          ) : !commissionHistory || commissionHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No paid referral commissions yet.</div>
          ) : (
            <div className="space-y-3">
              {commissionHistory.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-4 border border-border rounded-md">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Level {item.level}</Badge>
                      <span className="font-medium">{item.referredDisplayName || "Referral user"}</span>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Base {formatXnrt(item.baseAmount)} XNRT × {formatRate(item.rate)} • {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right font-bold text-chart-2">
                    +{formatXnrt(item.commission)} XNRT
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Network Tree */}
      <ReferralTree referrals={referralTree || []} isLoading={isLoadingTree} />

      {/* Referral Leaderboard */}
      <ReferralLeaderboard />

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Referral QR Code</DialogTitle>
            <DialogDescription>
              Share this QR code for easy mobile scanning
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <canvas ref={qrCanvasRef} className="border border-border rounded-md" />
            <Button
              onClick={downloadQRCode}
              data-testid="button-download-qr"
              className="w-full"
            >
              Download QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
