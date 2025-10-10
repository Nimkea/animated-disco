import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Gem, TrendingUp, Clock, AlertCircle, Sparkles, Wallet, ArrowUpRight, History, BarChart3, ArrowUpDown } from "lucide-react";
import { STAKING_TIERS, type StakingTier, type Stake, type Balance } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Real-time countdown component
function CountdownTimer({ endDate, stakeId }: { endDate: string; stakeId: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isMatured, setIsMatured] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endDate).getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
        setIsMatured(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsMatured(true);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [endDate]);

  if (isMatured) {
    return <span className="text-chart-2 font-semibold" data-testid={`countdown-matured-${stakeId}`}>Matured!</span>;
  }

  return (
    <div className="flex items-center gap-1 font-mono text-sm" data-testid={`countdown-timer-${stakeId}`}>
      {timeLeft.days > 0 && <span>{timeLeft.days}d </span>}
      <span>{String(timeLeft.hours).padStart(2, '0')}:</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}:</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  );
}

const tierIcons = {
  royal_sapphire: "💎",
  legendary_emerald: "🟢",
  imperial_platinum: "⚪",
  mythic_diamond: "💠",
};

const tierGradients = {
  royal_sapphire: "from-blue-500 to-cyan-500",
  legendary_emerald: "from-emerald-500 to-green-500",
  imperial_platinum: "from-slate-400 to-zinc-400",
  mythic_diamond: "from-purple-500 to-pink-500",
};

export default function Staking() {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<StakingTier | null>(null);
  const [amount, setAmount] = useState("");
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [historySortBy, setHistorySortBy] = useState<string>("date");

  const { data: balance } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const { data: stakes } = useQuery<Stake[]>({
    queryKey: ["/api/stakes"],
  });

  const processRewardsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/stakes/process-rewards", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
  });

  useEffect(() => {
    processRewardsMutation.mutate();
  }, []);

  const createStakeMutation = useMutation({
    mutationFn: async (data: { tier: StakingTier; amount: string }) => {
      return await apiRequest("POST", "/api/stakes", data);
    },
    onSuccess: () => {
      toast({
        title: "Stake Created!",
        description: "Your staking position has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stakes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      setAmount("");
      setSelectedTier(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create stake",
        variant: "destructive",
      });
    },
  });

  const withdrawStakeMutation = useMutation({
    mutationFn: async (stakeId: string) => {
      return await apiRequest("POST", `/api/stakes/${stakeId}/withdraw`, {});
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Successful!",
        description: "Your stake rewards have been transferred to your balance.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stakes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to withdraw stake",
        variant: "destructive",
      });
    },
  });

  const handleStake = () => {
    if (!selectedTier || !amount) return;

    const tierConfig = STAKING_TIERS[selectedTier];
    const stakeAmount = parseFloat(amount);

    if (stakeAmount < tierConfig.minAmount) {
      toast({
        title: "Amount Too Low",
        description: `Minimum stake for ${tierConfig.name} is ${tierConfig.minAmount.toLocaleString()} XNRT`,
        variant: "destructive",
      });
      return;
    }

    if (stakeAmount > tierConfig.maxAmount) {
      toast({
        title: "Amount Too High",
        description: `Maximum stake for ${tierConfig.name} is ${tierConfig.maxAmount.toLocaleString()} XNRT`,
        variant: "destructive",
      });
      return;
    }

    const availableBalance = parseFloat(balance?.xnrtBalance || "0");
    if (stakeAmount > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough XNRT to stake this amount",
        variant: "destructive",
      });
      return;
    }

    createStakeMutation.mutate({ tier: selectedTier, amount });
  };

  const calculateProfit = () => {
    if (!selectedTier || !amount) return { daily: 0, total: 0 };
    const tierConfig = STAKING_TIERS[selectedTier];
    const stakeAmount = parseFloat(amount);
    const dailyProfit = (stakeAmount * tierConfig.dailyRate) / 100;
    const totalProfit = dailyProfit * tierConfig.duration;
    return { daily: dailyProfit, total: totalProfit };
  };

  const profit = calculateProfit();

  // Separate active and withdrawn stakes
  const activeStakes = useMemo(() => {
    return stakes?.filter(s => s.status === "active" || s.status === "completed") || [];
  }, [stakes]);

  const withdrawnStakes = useMemo(() => {
    let filtered = stakes?.filter(s => s.status === "withdrawn") || [];
    
    // Filter by tier
    if (historyFilter !== "all") {
      filtered = filtered.filter(s => s.tier === historyFilter);
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (historySortBy) {
        case "date":
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case "profit":
          return parseFloat(b.totalProfit) - parseFloat(a.totalProfit);
        case "roi":
          const roiA = (parseFloat(a.totalProfit) / parseFloat(a.amount)) * 100;
          const roiB = (parseFloat(b.totalProfit) / parseFloat(b.amount)) * 100;
          return roiB - roiA;
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [stakes, historyFilter, historySortBy]);

  // Generate daily profit chart data for active stakes
  const profitChartData = useMemo(() => {
    if (!activeStakes.length) return [];
    
    const stake = activeStakes[0]; // Show chart for first active stake
    const tierConfig = STAKING_TIERS[stake.tier as StakingTier];
    const dailyProfit = (parseFloat(stake.amount) * parseFloat(stake.dailyRate)) / 100;
    
    const data = [];
    for (let day = 0; day <= tierConfig.duration; day++) {
      data.push({
        day: day,
        profit: dailyProfit * day,
        projected: dailyProfit * day,
      });
    }
    
    return data;
  }, [activeStakes]);

  // Tier performance data
  const tierPerformanceData = useMemo(() => {
    const tierStats: Record<string, { tier: string; totalProfit: number; count: number }> = {};
    
    withdrawnStakes.forEach(stake => {
      if (!tierStats[stake.tier]) {
        tierStats[stake.tier] = {
          tier: STAKING_TIERS[stake.tier as StakingTier].name,
          totalProfit: 0,
          count: 0,
        };
      }
      tierStats[stake.tier].totalProfit += parseFloat(stake.totalProfit);
      tierStats[stake.tier].count += 1;
    });
    
    return Object.values(tierStats);
  }, [withdrawnStakes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Staking</h1>
        <p className="text-muted-foreground">Stake your XNRT tokens to earn daily rewards</p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Available Balance
                </p>
                <p className="text-3xl font-bold font-mono" data-testid="text-available-balance">
                  {parseFloat(balance?.xnrtBalance || "0").toLocaleString()} XNRT
                </p>
              </div>
              <Gem className="h-12 w-12 text-primary" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground">Main</p>
                <p className="font-semibold font-mono text-sm">{parseFloat(balance?.xnrtBalance || "0").toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Staking</p>
                <p className="font-semibold font-mono text-sm text-chart-1">{parseFloat(balance?.stakingBalance || "0").toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mining</p>
                <p className="font-semibold font-mono text-sm text-chart-3">{parseFloat(balance?.miningBalance || "0").toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Referral</p>
                <p className="font-semibold font-mono text-sm text-chart-2">{parseFloat(balance?.referralBalance || "0").toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(STAKING_TIERS) as [StakingTier, typeof STAKING_TIERS[StakingTier]][]).map(([key, tier]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all hover-elevate ${
              selectedTier === key ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setSelectedTier(key)}
            data-testid={`tier-${key}`}
          >
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{tierIcons[key]}</span>
                <div>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>{tier.duration} days</CardDescription>
                </div>
              </div>
              <div className={`text-3xl font-bold bg-gradient-to-r ${tierGradients[key]} bg-clip-text text-transparent`}>
                {tier.apy}% APY
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Daily Rate:</span>
                <span className="font-semibold">{tier.dailyRate}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Min/Max:</span>
                <span className="font-semibold">
                  {tier.minAmount.toLocaleString()}/{tier.maxAmount.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTier && (
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle>Create Stake - {STAKING_TIERS[selectedTier].name}</CardTitle>
            <CardDescription>Enter the amount you want to stake</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Stake Amount (XNRT)</Label>
              <Input
                id="amount"
                type="number"
                placeholder={`Min: ${STAKING_TIERS[selectedTier].minAmount.toLocaleString()}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-stake-amount"
              />
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Daily Profit:</span>
                  <span className="font-bold text-chart-2">+{profit.daily.toLocaleString()} XNRT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Profit ({STAKING_TIERS[selectedTier].duration} days):</span>
                  <span className="font-bold text-chart-2">+{profit.total.toLocaleString()} XNRT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Final Amount:</span>
                  <span className="font-bold text-primary">
                    {(parseFloat(amount) + profit.total).toLocaleString()} XNRT
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!amount || createStakeMutation.isPending}
              onClick={handleStake}
              data-testid="button-create-stake"
            >
              {createStakeMutation.isPending ? "Creating..." : "Create Stake"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" data-testid="tab-active-stakes">
            <TrendingUp className="h-4 w-4 mr-2" />
            Active Stakes
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-stake-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-serif mb-4">Active Stakes</h2>
            {!activeStakes || activeStakes.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">No active stakes yet</p>
                  <p className="text-sm text-muted-foreground">Select a tier above to start staking</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeStakes.map((stake) => {
                  const tierConfig = STAKING_TIERS[stake.tier as StakingTier];
                  const progress = ((new Date().getTime() - new Date(stake.startDate).getTime()) / 
                    (new Date(stake.endDate).getTime() - new Date(stake.startDate).getTime())) * 100;
                  const daysLeft = Math.ceil((new Date(stake.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <Card key={stake.id} className="hover-elevate" data-testid={`stake-${stake.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{tierIcons[stake.tier as StakingTier]}</span>
                            <div>
                              <CardTitle className="text-base">{tierConfig.name}</CardTitle>
                              <CardDescription>{parseFloat(stake.amount).toLocaleString()} XNRT</CardDescription>
                            </div>
                          </div>
                          <Badge variant={stake.status === "active" ? "default" : "secondary"}>
                            {stake.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">{Math.min(100, Math.round(progress))}%</span>
                          </div>
                          <Progress value={Math.min(100, progress)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Daily Rate</p>
                            <p className="font-semibold">{tierConfig.dailyRate}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Time Left
                            </p>
                            <CountdownTimer endDate={stake.endDate.toString()} stakeId={stake.id} />
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Profit</p>
                            <p className="font-semibold text-chart-2">+{parseFloat(stake.totalProfit).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Est. Final</p>
                            <p className="font-semibold text-primary">
                              {(parseFloat(stake.amount) + parseFloat(stake.totalProfit)).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {daysLeft <= 0 && stake.status === "completed" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 bg-chart-2/10 rounded-md text-sm">
                              <AlertCircle className="h-4 w-4 text-chart-2" />
                              <span>Stake matured! Withdraw to claim rewards</span>
                            </div>
                            <Button
                              type="button"
                              className="w-full"
                              variant="default"
                              onClick={() => {
                                console.log("Withdraw button clicked for stake:", stake.id);
                                withdrawStakeMutation.mutate(stake.id);
                              }}
                              disabled={withdrawStakeMutation.isPending}
                              data-testid={`button-withdraw-${stake.id}`}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              {withdrawStakeMutation.isPending ? "Withdrawing..." : "Withdraw Stake"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold font-serif">Stake History</h2>
            <div className="flex gap-2">
              <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-history-filter">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="royal_sapphire">Royal Sapphire</SelectItem>
                  <SelectItem value="legendary_emerald">Legendary Emerald</SelectItem>
                  <SelectItem value="imperial_platinum">Imperial Platinum</SelectItem>
                  <SelectItem value="mythic_diamond">Mythic Diamond</SelectItem>
                </SelectContent>
              </Select>
              <Select value={historySortBy} onValueChange={setHistorySortBy}>
                <SelectTrigger className="w-[180px]" data-testid="select-history-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="profit">Profit</SelectItem>
                  <SelectItem value="roi">ROI %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!withdrawnStakes || withdrawnStakes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No stake history yet</p>
                <p className="text-sm text-muted-foreground">Your withdrawn stakes will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {withdrawnStakes.map((stake) => {
                const tierConfig = STAKING_TIERS[stake.tier as StakingTier];
                const roi = (parseFloat(stake.totalProfit) / parseFloat(stake.amount)) * 100;
                const totalDays = Math.floor((new Date(stake.endDate).getTime() - new Date(stake.startDate).getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <Card key={stake.id} className="hover-elevate" data-testid={`history-${stake.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tierIcons[stake.tier as StakingTier]}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{tierConfig.name}</p>
                              <Badge variant="secondary">Withdrawn</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(stake.startDate).toLocaleDateString()} - {new Date(stake.endDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-right">
                          <div>
                            <p className="text-xs text-muted-foreground">Stake Amount</p>
                            <p className="font-semibold">{parseFloat(stake.amount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Profit</p>
                            <p className="font-semibold text-chart-2">+{parseFloat(stake.totalProfit).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">ROI</p>
                            <p className="font-semibold text-primary">{roi.toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-2xl font-bold font-serif mb-4">Staking Analytics</h2>
          
          {activeStakes.length > 0 && profitChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Profit Growth</CardTitle>
                <CardDescription>Projected vs actual profit accumulation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={profitChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" label={{ value: 'Days', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Profit (XNRT)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="projected" stroke="#10b981" name="Projected Profit" />
                    <Line type="monotone" dataKey="profit" stroke="#3b82f6" name="Actual Profit" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {tierPerformanceData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tier Performance</CardTitle>
                <CardDescription>Total profits earned by tier</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tierPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tier" />
                    <YAxis label={{ value: 'Total Profit (XNRT)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalProfit" fill="#8b5cf6" name="Total Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {activeStakes.length === 0 && withdrawnStakes.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No analytics data yet</p>
                <p className="text-sm text-muted-foreground">Create your first stake to see performance analytics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
