export interface AdminDepositTransaction {
  id: string;
  userId: string;
  type: string;
  amount: string;
  usdtAmount?: string;
  transactionHash?: string;
  proofImageUrl?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  verified?: boolean;
  confirmations?: number;
  verificationData?: unknown;
  user?: {
    email: string;
    username: string;
  };
}

export interface ScannerStatus {
  enabled: boolean;
  running: boolean;
  rpcConfigured: boolean;
  watchedAddresses: number;
  pendingScannerDeposits: number;
  unmatchedDeposits: number;
  openReports: number;
  requiredConfirmations: number;
  state?: {
    lastBlock: number;
    lastScanAt: string;
    errorCount: number;
    lastError?: string | null;
  } | null;
}

export type BulkDepositAction = "approve" | "reject";
