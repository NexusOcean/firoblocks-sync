import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CachedAddress, AddressDocument } from './address-sync.schema';
import { FiroAddressBalance, FiroAddressTxIds } from './address-sync.types';
import { TransactionDto } from 'src/transactions/transactions.types';

const SATOSHIS = 1e8;
const PAGE_SIZE = 10;
const CONCURRENCY = 3;
const ADDRESS_TTL_MS = 15 * 60 * 1000;
const MAX_TX_IDS = 1000;

@Injectable()
export class AddressSyncService {
  private readonly logger = new Logger(AddressSyncService.name);

  constructor(
    private readonly rpc: RpcService,
    private readonly txService: TransactionsService,
    @InjectModel(CachedAddress.name)
    private readonly addressModel: Model<AddressDocument>,
  ) {}

  async warmAddress(address: string): Promise<void> {
    const cached = await this.addressModel.findOne({ address }).lean();
    if (cached && cached.expiresAt > new Date()) return;

    const [balanceRaw, allTxIds] = await Promise.all([
      this.rpc.call<FiroAddressBalance>('getaddressbalance', [{ addresses: [address] }]),
      this.rpc.call<FiroAddressTxIds>('getaddresstxids', [{ addresses: [address] }]),
    ]);

    if (!allTxIds?.length) return;

    const reversed: string[] = [...allTxIds].reverse().slice(0, MAX_TX_IDS);
    const totalTxCount = reversed.length;
    const totalPages = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE));
    const firstPageTxs = await this.hydrateIds(reversed.slice(0, PAGE_SIZE));

    const dto = {
      address,
      balance: balanceRaw.balance / SATOSHIS,
      received: balanceRaw.received / SATOSHIS,
      totalTxCount,
      transactions: firstPageTxs.map((tx) => this.toSummaryDto(tx, address)),
      page: 1,
      totalPages,
      hydrating: reversed.length > PAGE_SIZE,
      allTxIds: reversed,
    };

    await this.cache(address, dto);
    this.logger.log(`Warmed address: ${address}`);
  }

  private async hydrateIds(txids: string[]) {
    const results: TransactionDto[] = [];

    for (let i = 0; i < txids.length; i += CONCURRENCY) {
      const batch = txids.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((id) => this.txService.getTransaction(id)),
      );
      for (const result of settled) {
        if (result.status === 'fulfilled') results.push(result.value);
        else this.logger.warn(`Failed to hydrate tx: ${result.reason}`);
      }
    }

    return results;
  }

  private toSummaryDto(tx: any, address: string) {
    const totalOut = tx.vout
      .filter((v) => v.addresses.includes(address))
      .reduce((s, v) => s + v.value, 0);

    const totalIn = tx.vin
      .filter((v) => v.address === address)
      .reduce((s, v) => s + (v.value ?? 0), 0);

    const valueDelta =
      tx.type === 'transparent' || tx.type === 'coinbase'
        ? parseFloat((totalOut - totalIn).toFixed(8))
        : undefined;

    return {
      txid: tx.txid,
      type: tx.type,
      time: tx.time,
      blockHeight: tx.blockHeight,
      confirmations: tx.confirmations,
      valueDelta,
    };
  }

  private async cache(address: string, dto: object): Promise<void> {
    const expiresAt = new Date(Date.now() + ADDRESS_TTL_MS);
    await this.addressModel.updateOne(
      { address },
      { $set: { address, data: dto, expiresAt } },
      { upsert: true },
    );
  }
}
