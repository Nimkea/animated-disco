import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Share2, DollarSign, QrCode } from "lucide-react";
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

  const referralCode = user?.referralCode || "";
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

  const generateQRCode = async () => {
    if (qrCanvasRef.current && referralLink) {
      try {
        await QRCode.toCanvas(qrCanvasRef.current, referralLink, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setShowQR(true);
      } catch (error) {
        console.error('Error generating QR code:', error);
        toast({
          title: "Error",
          description: "Failed to generate QR code",
          variant: "destructive",
        });
      }
    }
  };

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
    },
    {
      level: 2,
      count: referralStats?.level2Count || 0,
      commission: referralStats?.level2Commission || "0",
      rate: "3%",
      color: "text-chart-2",
    },
    {
      level: 3,
      count: referralStats?.level3Count || 0,
      commission: referralStats?.level3Commission || "0",
      rate: "1%",
      color: "text-chart-3",
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
              onClick={generateQRCode}
              data-testid="button-generate-qr"
            >
              <QrCode className="mr-2 h-5 w-5" />
              Generate QR Code
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Commissions</CardTitle>
            <CardDescription>Earnings from all referral levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <DollarSign className="h-8 w-8 text-chart-2" />
              <span className="text-5xl font-bold font-mono text-chart-2" data-testid="text-total-commission">
                {parseFloat(referralStats?.totalCommission || "0").toLocaleString()}
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
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {levelStats.map((stat) => (
          <Card key={stat.level} className="hover-elevate">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Level {stat.level}</CardTitle>
                <Badge variant="secondary" className="font-mono">{stat.rate}</Badge>
              </div>
              <CardDescription>
                {stat.level === 1 ? "Direct" : "Indirect"} referrals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Count:</span>
                <span className="text-2xl font-bold" data-testid={`stat-level${stat.level}-count`}>
                  {stat.count}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Earned:</span>
                <span className={`text-xl font-bold ${stat.color}`} data-testid={`stat-level${stat.level}-commission`}>
                  {parseFloat(stat.commission).toLocaleString()}
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
                      <p className="font-semibold">Level {referral.level} Referral</p>
                      <p className="text-sm text-muted-foreground">
                        {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-chart-2">
                      {parseFloat(referral.totalCommission).toLocaleString()} XNRT
                    </div>
                    <p className="text-xs text-muted-foreground">earned</p>
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
