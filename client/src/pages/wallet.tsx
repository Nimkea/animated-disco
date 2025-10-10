import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet as WalletIcon, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Gem, Users, Pickaxe } from "lucide-react";
import { SkeletonWallet } from "@/components/skeletons";
import type { Balance, Transaction } from "@shared/schema";

export default function Wallet() {
  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  if (balanceLoading || transactionsLoading) {
    return <SkeletonWallet />;
  }

  const balanceBreakdown = [
    {
      label: "Main Balance",
      value: balance?.xnrtBalance || "0",
      icon: WalletIcon,
      color: "text-primary",
    },
    {
      label: "Staking Balance",
      value: balance?.stakingBalance || "0",
      icon: Gem,
      color: "text-chart-5",
    },
    {
      label: "Mining Balance",
      value: balance?.miningBalance || "0",
      icon: Pickaxe,
      color: "text-chart-3",
    },
    {
      label: "Referral Balance",
      value: balance?.referralBalance || "0",
      icon: Users,
      color: "text-chart-2",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Wallet</h1>
        <p className="text-muted-foreground">Manage your XNRT tokens and view transactions</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Total Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <WalletIcon className="h-12 w-12 text-primary" />
            <div>
              <p className="text-6xl font-bold font-mono bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid="text-total-balance">
                {parseFloat(balance?.xnrtBalance || "0").toLocaleString()}
              </p>
              <p className="text-xl text-muted-foreground">XNRT</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chart-2" />
            <p className="text-sm text-muted-foreground">
              Total Earned: <span className="font-bold text-chart-2">{parseFloat(balance?.totalEarned || "0").toLocaleString()} XNRT</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balanceBreakdown.map((item) => (
          <Card key={item.label} className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <p className="text-3xl font-bold font-mono" data-testid={`balance-${item.label.toLowerCase().replace(' ', '-')}`}>
                {parseFloat(item.value).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All your deposits and withdrawals</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="deposits" data-testid="tab-deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">Withdrawals</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-6">
              {!transactions || transactions.length === 0 ? (
                <div className="text-center py-12">
                  <WalletIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No transactions yet</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))
              )}
            </TabsContent>

            <TabsContent value="deposits" className="space-y-3 mt-6">
              {!transactions || transactions.filter(t => t.type === "deposit").length === 0 ? (
                <div className="text-center py-12">
                  <ArrowDownToLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No deposits yet</p>
                </div>
              ) : (
                transactions
                  .filter(t => t.type === "deposit")
                  .map((tx) => <TransactionItem key={tx.id} transaction={tx} />)
              )}
            </TabsContent>

            <TabsContent value="withdrawals" className="space-y-3 mt-6">
              {!transactions || transactions.filter(t => t.type === "withdrawal").length === 0 ? (
                <div className="text-center py-12">
                  <ArrowUpFromLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No withdrawals yet</p>
                </div>
              ) : (
                transactions
                  .filter(t => t.type === "withdrawal")
                  .map((tx) => <TransactionItem key={tx.id} transaction={tx} />)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isDeposit = transaction.type === "deposit";
  const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "paid":
        return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      case "pending":
        return "bg-chart-3/20 text-chart-3 border-chart-3/30";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  return (
    <div
      className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
      data-testid={`transaction-${transaction.id}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
          isDeposit ? "bg-primary/20" : "bg-chart-2/20"
        }`}>
          <Icon className={`h-6 w-6 ${isDeposit ? "text-primary" : "text-chart-2"}`} />
        </div>
        <div>
          <p className="font-semibold capitalize">{transaction.type}</p>
          <p className="text-sm text-muted-foreground">
            {parseFloat(transaction.amount).toLocaleString()} XNRT
            {transaction.usdtAmount && ` (${parseFloat(transaction.usdtAmount).toFixed(2)} USDT)`}
          </p>
          <p className="text-xs text-muted-foreground">
            {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A'}
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge className={getStatusColor(transaction.status)} variant="outline">
          {transaction.status}
        </Badge>
        {transaction.fee && !isDeposit && (
          <p className="text-xs text-muted-foreground mt-1">
            Fee: {parseFloat(transaction.fee).toLocaleString()} XNRT
          </p>
        )}
      </div>
    </div>
  );
}
