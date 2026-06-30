import { Prisma } from "@prisma/client";
import type { InsertTransaction, Transaction } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaTransaction } from "./converters";

function buildTransactionData(transaction: InsertTransaction | Partial<Transaction>): any {
  const data: any = {};

  if ("userId" in transaction && transaction.userId !== undefined) data.userId = transaction.userId;
  if (transaction.type !== undefined) data.type = transaction.type;
  if (transaction.amount !== undefined && transaction.amount !== null) data.amount = new Prisma.Decimal(transaction.amount);
  if (transaction.status !== undefined) data.status = transaction.status;
  if (transaction.usdtAmount !== undefined && transaction.usdtAmount !== null) data.usdtAmount = new Prisma.Decimal(transaction.usdtAmount);
  if (transaction.source !== undefined && transaction.source !== null) data.source = transaction.source;
  if (transaction.walletAddress !== undefined && transaction.walletAddress !== null) data.walletAddress = transaction.walletAddress;
  if (transaction.transactionHash !== undefined && transaction.transactionHash !== null) data.transactionHash = transaction.transactionHash;
  if (transaction.proofImageUrl !== undefined && transaction.proofImageUrl !== null) data.proofImageUrl = transaction.proofImageUrl;
  if (transaction.adminNotes !== undefined && transaction.adminNotes !== null) data.adminNotes = transaction.adminNotes;
  if (transaction.fee !== undefined && transaction.fee !== null) data.fee = new Prisma.Decimal(transaction.fee);
  if (transaction.netAmount !== undefined && transaction.netAmount !== null) data.netAmount = new Prisma.Decimal(transaction.netAmount);
  if (transaction.approvedBy !== undefined && transaction.approvedBy !== null) data.approvedBy = transaction.approvedBy;
  if (transaction.approvedAt !== undefined && transaction.approvedAt !== null) data.approvedAt = transaction.approvedAt;
  if (transaction.verified !== undefined) data.verified = transaction.verified;
  if (transaction.confirmations !== undefined) data.confirmations = transaction.confirmations;
  if (transaction.verificationData !== undefined && transaction.verificationData !== null) data.verificationData = transaction.verificationData;
  return data;
}

export class TransactionRepository {
  async findByUser(userId: string, type?: string): Promise<Transaction[]> {
    const where: any = { userId };
    if (type) where.type = type;
    const transactions = await prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 });
    return transactions.map(convertPrismaTransaction);
  }

  async findById(id: string): Promise<Transaction | undefined> {
    const transaction = await prisma.transaction.findUnique({ where: { id } });
    return transaction ? convertPrismaTransaction(transaction) : undefined;
  }

  async create(transaction: InsertTransaction): Promise<Transaction> {
    const data = buildTransactionData(transaction);
    data.status = data.status || "pending";
    const newTransaction = await prisma.transaction.create({ data });
    return convertPrismaTransaction(newTransaction);
  }

  async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const transaction = await prisma.transaction.update({ where: { id }, data: buildTransactionData(updates) });
    return convertPrismaTransaction(transaction);
  }

  async findAll(type?: string): Promise<Transaction[]> {
    const where: any = {};
    if (type) where.type = type;
    const transactions = await prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 });
    return transactions.map(convertPrismaTransaction);
  }

  async findPending(type: string): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { type, status: "pending" },
      include: { user: { select: { email: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return transactions.map(convertPrismaTransaction);
  }
}

export const transactionRepository = new TransactionRepository();
