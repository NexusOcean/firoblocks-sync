import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import {
  CachedTransaction,
  TransactionDocument,
  RecentTransactionsCache,
  RecentTransactionsCacheDocument,
} from './transactions.schema';
import {
  FiroTransaction,
  TransactionDto,
  TxType,
  TxVinDto,
  TxVoutDto,
  isCoinbaseVin,
  isSparkSpendVin,
  isTransparentVin,
} from './transactions.types';

const TIP_TTL_MS = 15_000;
const CONFIRMED_TTL_MS = 365 * 24 * 60 * 60 * 1000;
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

    const raw = await this.rpc.call<FiroTransaction>('getrawtransaction', [txid, true]);
    if (!raw) throw new NotFoundException(`Transaction ${txid} not found`);

    const dto = this.toTransactionDto(raw);
    await this.cache(dto, raw.chainlock);
    return dto;
  }

  async getTransactionsByBlock(txids: string[]): Promise<TransactionDto[]> {
    const cached = await this.txModel.find({ txid: { $in: txids } }).lean();
    const cachedMap = new Map(
      cached.map((doc) => [doc.txid, doc.data as unknown as TransactionDto]),
    );

    const tip = await this.getChainTip();
    const results: TransactionDto[] = [];

    for (const txid of txids) {
      const hit = cachedMap.get(txid);
      if (hit) {
        results.push({ ...hit, confirmations: tip - hit.blockHeight + 1 });
        continue;
      }
      try {
        const raw = await this.rpc.call<FiroTransaction>('getrawtransaction', [txid, true]);
        const dto = this.toTransactionDto(raw);
        await this.cache(dto, raw.chainlock);
        results.push(dto);
      } catch (err) {
        this.logger.warn(`Failed to fetch tx ${txid}: ${err}`);
      }
    }

    return results;
  }

  async getRecentTransactions(limit = 10): Promise<TransactionDto[]> {
    const tip = await this.getChainTip();
    const txids: string[] = [];
    let height = tip;

    while (txids.length < limit && height > 0) {
      const hash = await this.rpc.call<string>('getblockhash', [height]);
      const block = await this.rpc.call<{ tx: string[] }>('getblock', [hash, true]);
      txids.push(...block.tx);
      height--;
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
    return cached.data as unknown as TransactionDto[];
  }

  private toTransactionDto(raw: FiroTransaction): TransactionDto {
    const type = this.resolveTxType(raw);
    const vin = raw.vin.map((v) => this.toVinDto(v));
    const vout = raw.vout.map((v) => this.toVoutDto(v));
    const fee = this.computeFee(type, raw, vin, vout);

    return {
      txid: raw.txid,
      type,
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

  private resolveTxType(raw: FiroTransaction): TxType {
    switch (raw.type) {
      case 5:
        return 'coinbase';
      case 9:
        return 'spark';
      case 0:
        return 'transparent';
      default:
        return 'unknown';
    }
  }

  private toVinDto(vin: FiroTransaction['vin'][number]): TxVinDto {
    if (isCoinbaseVin(vin)) return { coinbase: vin.coinbase };
    if (isSparkSpendVin(vin)) return { nFees: vin.nFees, lTags: vin.lTags };
    if (isTransparentVin(vin)) {
      return {
        txid: vin.txid,
        vout: vin.vout,
        address: vin.address,
        value: vin.value,
      };
    }
    return {};
  }

  private toVoutDto(vout: FiroTransaction['vout'][number]): TxVoutDto {
    return {
      n: vout.n,
      value: vout.value,
      type: vout.scriptPubKey.type,
      addresses: vout.scriptPubKey.addresses ?? [],
    };
  }

  private computeFee(
    type: TxType,
    raw: FiroTransaction,
    vin: TxVinDto[],
    vout: TxVoutDto[],
  ): number | undefined {
    if (type === 'spark') {
      const sparkVin = raw.vin.find(isSparkSpendVin);
      return sparkVin?.nFees;
    }
    if (type === 'transparent') {
      const totalIn = vin.reduce((s, v) => s + (v.value ?? 0), 0);
      const totalOut = vout.reduce((s, v) => s + v.value, 0);
      const fee = totalIn - totalOut;
      return fee > 0 ? parseFloat(fee.toFixed(8)) : undefined;
    }
    return undefined;
  }

  private async getChainTip(): Promise<number> {
    if (this.tipCache && Date.now() < this.tipCache.expiresAt) {
      return this.tipCache.value;
    }
    const info = await this.rpc.call<{ blocks: number }>('getblockchaininfo');
    this.tipCache = { value: info.blocks, expiresAt: Date.now() + TIP_TTL_MS };
    return info.blocks;
  }

  private async cache(tx: TransactionDto, chainlock: boolean): Promise<void> {
    const ttlMs = chainlock ? CONFIRMED_TTL_MS : TIP_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    const { confirmations: _, ...dataToStore } = tx;

    await this.txModel.updateOne(
      { txid: tx.txid },
      { $set: { txid: tx.txid, data: dataToStore, expiresAt } },
      { upsert: true },
    );
  }
}
