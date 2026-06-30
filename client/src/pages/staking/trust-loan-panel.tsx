import { Link } from "wouter";
import { BadgeCheck, Info, Sparkles, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StakingSummary, TrustLoanStatus } from "./types";
import { formatXnrt, StakingStatCard } from "./utils";

export function TrustLoanPanel({
  summary,
  trustLoanStatus,
  trustDirectProgress,
  trustInvestorProgress,
  canClaimTrustLoan,
  isClaiming,
  onClaim,
}: {
  summary?: StakingSummary;
  trustLoanStatus?: TrustLoanStatus;
  trustDirectProgress: number;
  trustInvestorProgress: number;
  canClaimTrustLoan: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  const trustLoan = trustLoanStatus ?? summary?.trustLoan;

  return (
    <Card className="overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Trust Loan Program</CardTitle>
        <CardDescription>
          Eligibility-based virtual staking principal. Only generated profit is withdrawable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <StakingStatCard
            title="Virtual Amount"
            value={`${formatXnrt(trustLoan?.amountXnrt ?? summary?.trustLoan.amountXnrt)} XNRT`}
            subtitle={`${trustLoan?.durationDays ?? summary?.trustLoan.durationDays ?? 30} days program`}
            icon={Sparkles}
          />
          <StakingStatCard
            title="Direct Referrals"
            value={`${trustLoan?.directCount ?? 0}/${trustLoan?.requiredReferrals ?? 3}`}
            subtitle="Required L1 referrals"
            icon={Users}
          />
          <StakingStatCard
            title="Investing Referrals"
            value={`${trustLoan?.investingCount ?? 0}/${trustLoan?.requiredInvestingReferrals ?? 2}`}
            subtitle="Required approved deposits"
            icon={BadgeCheck}
          />
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Direct referral progress</span><span>{Math.round(trustDirectProgress)}%</span>
            </div>
            <Progress value={trustDirectProgress} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Investing referral progress</span><span>{Math.round(trustInvestorProgress)}%</span>
            </div>
            <Progress value={trustInvestorProgress} />
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How Trust Loan works</AlertTitle>
          <AlertDescription>
            Trust Loan is a virtual principal stake for qualified users. It does not add withdrawable principal to your wallet; only earned platform reward profit can be withdrawn after maturity.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={!canClaimTrustLoan || isClaiming}
            onClick={onClaim}
            data-testid="button-claim-trust-loan"
          >
            {trustLoanStatus?.hasLoanStake ? "Already Claimed" : canClaimTrustLoan ? "Claim Trust Loan" : "Eligibility Not Complete"}
          </Button>
          <Button asChild variant="outline" data-testid="button-open-trust-loan-page">
            <Link href="/trust-loan">Open Trust Loan Page</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
