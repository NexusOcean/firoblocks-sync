import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import {
  CachedTransaction,
  TransactionDocument,
  RecentTransactionsCache,
  RecentTransactionsCacheDocument,
} from './transactions.schema';
import { FiroTransaction, TransactionDto } from './transactions.types';
import { classifyTransaction } from './transaction-classifier';

const TIP_TTL_MS = 15_000;
const RECENT_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private tipCache: { value: number; expiresAt: number } | null = null;

  constructor(
    private readonly rpc: RpcService,
    @InjectModel(CachedTransaction.name)
    private readonly txModel: Model<TransactionDocument>,
    @InjectModel(RecentTransactionsCache.name)
    private readonly recentTxModel: Model<RecentTransactionsCacheDocument>,
  ) {}

  async getTransaction(txid: string): Promise<TransactionDto> {
    const cached = await this.txModel.findOne({ txid }).lean();
    if (cached) {
      const dto = cached.data as unknown as TransactionDto;
      const tip = await this.getChainTip();
      return { ...dto, confirmations: tip - dto.blockHeight + 1 };
    }

    const raw = await this.rpc.call<FiroTransaction>('getrawtransaction', txid, true);
    if (!raw) throw new NotFoundException(`Transaction ${txid} not found`);

    const dto = this.toTransactionDto(raw);
    await this.cache(dto);
    return dto;
  }

  async getTransactionsByBlock(txids: string[]): Promise<TransactionDto[]> {
    const uniqueIds = [...new Set(txids)];

    const cached = await this.txModel.find({ txid: { $in: uniqueIds } }).lean();
    const dtoMap = new Map(cached.map((doc) => [doc.txid, doc.data as unknown as TransactionDto]));

    const tip = await this.getChainTip();
    const uncachedIds = uniqueIds.filter((id) => !dtoMap.has(id));

    if (uncachedIds.length > 0) {
      const batchResults = await this.rpc.batch(
        uncachedIds.map((txid) => ({ method: 'getrawtransaction', params: [txid, true] })),
      );

      const bulkOps: AnyBulkWriteOperation<{
        txid: string;
        data: Omit<TransactionDto, 'confirmations'>;
      }>[] = [];

      for (let i = 0; i < uncachedIds.length; i++) {
        const { result, error } = batchResults[i];
        if (error) {
          this.logger.warn(`Failed to fetch tx ${uncachedIds[i]}: ${error.message}`);
          continue;
        }

        const dto = this.toTransactionDto(result as FiroTransaction);
        const { confirmations: _, ...dataToStore } = dto;
        dtoMap.set(uncachedIds[i], dto);

        bulkOps.push({
          updateOne: {
            filter: { txid: dto.txid },
            update: { $set: { txid: dto.txid, data: dataToStore } },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        await this.txModel.bulkWrite(bulkOps, { ordered: false });
      }
    }

    const results: TransactionDto[] = [];
    for (const txid of uniqueIds) {
      const dto = dtoMap.get(txid);
      if (dto) results.push({ ...dto, confirmations: tip - dto.blockHeight + 1 });
    }

    return results;
  }

  async getRecentTransactions(limit = 15): Promise<TransactionDto[]> {
    const cached = await this.getCachedRecentTransactions();
    if (cached) return cached;

    return this.getRecentTransactionsFromRpc(limit);
  }

  async getRecentTransactionsFromRpc(limit = 15): Promise<TransactionDto[]> {
    const tip = await this.getChainTip();

    const hashResults = await this.rpc.batch(
      Array.from({ length: 10 }, (_, i) => ({
        method: 'getblockhash',
        params: [tip - i],
      })),
    );
    const blockHashes = hashResults.map((r) => r.result as string);

    const blockResults = await this.rpc.batch(
      blockHashes.map((hash) => ({
        method: 'getblock',
        params: [hash, true],
      })),
    );

    const txids: string[] = [];
    for (const r of blockResults) {
      const block = r.result as { tx: string[] };
      txids.push(...block.tx);
      if (txids.length >= limit) break;
    }

    return this.getTransactionsByBlock(txids.slice(0, limit));
  }

  async saveRecentTransactions(txs: TransactionDto[]): Promise<void> {
    const expiresAt = new Date(Date.now() + RECENT_TTL_MS);
    await this.recentTxModel.updateOne(
      { key: 'recent' },
      { $set: { key: 'recent', data: txs, expiresAt } },
      { upsert: true },
    );
  }

  async getCachedRecentTransactions(): Promise<TransactionDto[] | null> {
    const cached = await this.recentTxModel.findOne({ key: 'recent' }).lean();
    if (!cached) return null;
    if (new Date() > cached.expiresAt) return null;
    return cached.data as unknown as TransactionDto[];
  }

  private toTransactionDto(raw: FiroTransaction): TransactionDto {
    const { type, category, flags, vin, vout, fee } = classifyTransaction(raw);

    return {
      txid: raw.txid,
      type,
      category,
      flags,
      size: raw.size,
      fee,
      confirmations: raw.confirmations,
      time: raw.time,
      blockHash: raw.blockhash,
      blockHeight: raw.height,
      chainlock: raw.chainlock,
      instantlock: raw.instantlock,
      vin,
      vout,
    };
  }

  private async getChainTip(): Promise<number> {
    if (this.tipCache && Date.now() < this.tipCache.expiresAt) {
      return this.tipCache.value;
    }
    const info = await this.rpc.call<{ blocks: number }>('getblockchaininfo');
    this.tipCache = { value: info.blocks, expiresAt: Date.now() + TIP_TTL_MS };
    return info.blocks;
  }

  private async cache(tx: TransactionDto): Promise<void> {
    const { confirmations: _, ...dataToStore } = tx;

    await this.txModel.updateOne(
      { txid: tx.txid },
      { $set: { txid: tx.txid, data: dataToStore } },
      { upsert: true },
    );
  }
}
