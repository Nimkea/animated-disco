import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonWallet } from "@/components/skeletons";
import type { Transaction } from "@shared/schema";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCheck,
  Clock,
  Copy,
  ExternalLink,
  Gem,
  Pickaxe,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  network: string;
  chainId: number;
  explorerUrl: string | null;
}

interface WalletSummary {
  balance: {
    available: number;
    staking: number;
    mining: number;
    referral: number;
    totalWalletValue: number;
    totalEarned: number;
  };
  deposit: {
    address: string;
    network: string;
    token: string;
    approvedCount: number;
    totalUsdtDeposited: number;
    totalXnrtCredited: number;
  };
  withdrawals: {
    reservedBySource: Record<string, { amount: number; fee: number; netAmount: number; count: number }>;
    approvedCount: number;
    totalRequested: number;
    totalFees: number;
    totalPaid: number;
  };
  rates: {
    xnrtPerUsdt: number;
    usdtPerXnrt: number;
    withdrawalFeePercent: number;
    confirmations: number;
    network: string;
    depositToken: string;
    withdrawalToken: string;
    withdrawalMode: string;
  };
  recentTransactions: Transaction[];
}

const formatNumber = (value?: number | string | null, digits = 2) => {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

export default function Wallet() {
  const { data: summary, isLoading: summaryLoading, isError } = useQuery<WalletSummary>({
    queryKey: ["/api/wallet/summary"],
  });

  const { data: tokenInfo } = useQuery<TokenInfo>({
    queryKey: ["/api/token/info"],
  });

  if (summaryLoading) return <SkeletonWallet />;

  if (isError || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-serif">Wallet</h1>
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center">
            <p className="font-semibold">Could not load wallet summary.</p>
            <p className="text-sm text-muted-foreground mt-1">Refresh the page or try again after a moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const transactions = summary.recentTransactions || [];
  const reserved = summary.withdrawals.reservedBySource?.total?.amount || 0;
  const balanceBreakdown = [
    { label: "Available", value: summary.balance.available, icon: WalletIcon, tone: "text-primary" },
    { label: "Staking", value: summary.balance.staking, icon: Gem, tone: "text-chart-5" },
    { label: "Mining", value: summary.balance.mining, icon: Pickaxe, tone: "text-chart-3" },
    { label: "Referral", value: summary.balance.referral, icon: Users, tone: "text-chart-2" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Wallet</h1>
          <p className="text-muted-foreground">Professional wallet dashboard for deposits, reserved withdrawals, and XNRT balances</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/deposit"><Button className="gap-2"><ArrowDownToLine className="h-4 w-4" /> Deposit</Button></Link>
          <Link href="/withdrawal"><Button variant="outline" className="gap-2"><ArrowUpFromLine className="h-4 w-4" /> Withdraw</Button></Link>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
        <CardContent className="p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Wallet v2</Badge>
                <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Reserved withdrawals</Badge>
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-muted-foreground">Total Wallet Value</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <p className="text-5xl md:text-6xl font-bold font-mono bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid="text-total-wallet-value">
                    {formatNumber(summary.balance.totalWalletValue)}
                  </p>
                  <p className="text-xl text-muted-foreground">XNRT</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Available + staking + mining + referral balances. Total earned: <span className="font-semibold text-chart-2">{formatNumber(summary.balance.totalEarned)} XNRT</span>
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pending / Reserved</p>
                <Clock className="h-5 w-5 text-chart-3" />
              </div>
              <p className="mt-2 text-3xl font-bold font-mono">{formatNumber(reserved)} XNRT</p>
              <p className="mt-1 text-xs text-muted-foreground">Pending withdrawals are reserved so users cannot double-spend the same balance.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balanceBreakdown.map((item) => (
          <Card key={item.label} className="hover-elevate">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{item.label} Balance</p>
                <item.icon className={`h-5 w-5 ${item.tone}`} />
              </div>
              <p className="text-3xl font-bold font-mono" data-testid={`balance-${item.label.toLowerCase()}`}>
                {formatNumber(item.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">XNRT</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Deposit Address</CardTitle>
            <CardDescription>Send USDT BEP-20 to your personal deposit address for auto-credit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyText value={summary.deposit.address} />
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile label="Rate" value={`1 USDT = ${formatNumber(summary.rates.xnrtPerUsdt, 0)} XNRT`} />
              <InfoTile label="Confirmations" value={`${summary.rates.confirmations} blocks`} />
              <InfoTile label="Deposited" value={`${formatNumber(summary.deposit.totalXnrtCredited)} XNRT`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Rules</CardTitle>
            <CardDescription>Current platform withdrawal configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoTile label="Token paid" value={summary.rates.withdrawalToken} />
            <InfoTile label="Fee" value={`${formatNumber(summary.rates.withdrawalFeePercent)}%`} />
            <InfoTile label="Approved withdrawals" value={String(summary.withdrawals.approvedCount)} />
          </CardContent>
        </Card>
      </div>

      <TokenContractCard tokenInfo={tokenInfo} />

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent deposits and withdrawals</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="deposits" data-testid="tab-deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">Withdrawals</TabsTrigger>
            </TabsList>

            <TransactionList transactions={transactions} />
            <TabsContent value="deposits" className="space-y-3 mt-6">
              <TransactionRows transactions={transactions.filter((t) => t.type === "deposit")} emptyLabel="No deposits yet" />
            </TabsContent>
            <TabsContent value="withdrawals" className="space-y-3 mt-6">
              <TransactionRows transactions={transactions.filter((t) => t.type === "withdrawal")} emptyLabel="No withdrawals yet" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <TabsContent value="all" className="space-y-3 mt-6">
      <TransactionRows transactions={transactions} emptyLabel="No transactions yet" />
    </TabsContent>
  );
}

function TransactionRows({ transactions, emptyLabel }: { transactions: Transaction[]; emptyLabel: string }) {
  if (!transactions.length) {
    return (
      <div className="text-center py-12">
        <WalletIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return <>{transactions.map((tx) => <TransactionItem key={tx.id} transaction={tx} />)}</>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
      <code className="flex-1 break-all text-xs md:text-sm font-mono">{value}</code>
      <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-2">
        {copied ? <CheckCheck className="h-4 w-4 text-chart-2" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function TokenContractCard({ tokenInfo }: { tokenInfo?: TokenInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!tokenInfo?.address) return;
    navigator.clipboard.writeText(tokenInfo.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gem className="h-5 w-5 text-secondary" />
          XNRT Token Contract
        </CardTitle>
        <CardDescription>BEP-20 token on {tokenInfo?.network ?? "BSC Testnet"}</CardDescription>
      </CardHeader>
      <CardContent>
        {tokenInfo?.address ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
              <code className="text-xs font-mono flex-1 break-all text-foreground/80" data-testid="text-xnrt-contract-address">
                {tokenInfo.address}
              </code>
              <button onClick={handleCopy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Copy address" data-testid="button-copy-contract-address">
                {copied ? <CheckCheck className="h-4 w-4 text-chart-2" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {tokenInfo.explorerUrl && (
              <a href={tokenInfo.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline" data-testid="link-xnrt-explorer">
                View on BSCScan <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Contract not yet deployed. Check back after the administrator completes the BSC Testnet deployment.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isDeposit = transaction.type === "deposit";
  const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;
  const txHash = transaction.transactionHash ?? null;
  const showOnChainLink = (transaction.status === "approved" || transaction.status === "paid") && txHash;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "paid":
        return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      case "processing":
        return "bg-primary/20 text-primary border-primary/30";
      case "pending":
        return "bg-chart-3/20 text-chart-3 border-chart-3/30";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 hover-elevate sm:flex-row sm:items-center sm:justify-between" data-testid={`transaction-${transaction.id}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDeposit ? "bg-primary/20" : "bg-chart-2/20"}`}>
          <Icon className={`h-6 w-6 ${isDeposit ? "text-primary" : "text-chart-2"}`} />
        </div>
        <div>
          <p className="font-semibold capitalize">{transaction.type} {transaction.source ? <span className="text-muted-foreground">· {transaction.source}</span> : null}</p>
          <p className="text-sm text-muted-foreground">
            {formatNumber(transaction.amount)} XNRT
            {transaction.usdtAmount ? ` (${formatNumber(transaction.usdtAmount)} USDT value)` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "N/A"}</p>
          {showOnChainLink && (
            <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary hover:underline mt-0.5" data-testid={`link-tx-explorer-${transaction.id}`}>
              View on BSCScan <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="text-left sm:text-right">
        <Badge className={getStatusColor(transaction.status)} variant="outline">{transaction.status}</Badge>
        {transaction.fee && !isDeposit && (
          <p className="text-xs text-muted-foreground mt-1">Fee: {formatNumber(transaction.fee)} XNRT</p>
        )}
      </div>
    </div>
  );
}
