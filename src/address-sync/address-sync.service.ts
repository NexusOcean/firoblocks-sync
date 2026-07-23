import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import { CachedAddress, AddressDocument } from './address-sync.schema';
import { FiroAddressBalance, FiroAddressTxIds } from './address-sync.types';

const SATOSHIS = 1e8;
const MAX_TX_IDS = 1000;
const CHUNK_SIZE = 50_000;

@Injectable()
export class AddressSyncService {
  private readonly logger = new Logger(AddressSyncService.name);

  constructor(
    private readonly rpc: RpcService,
    @InjectModel(CachedAddress.name)
    private readonly addressModel: Model<AddressDocument>,
  ) {}

  async warmAddress(address: string): Promise<void> {
    const cached = await this.addressModel
      .findOne({ address, expiresAt: { $gt: new Date() } })
      .lean();

    if (cached) return;

    const [infoResult, balanceResult] = await this.rpc.batch([
      { method: 'getblockchaininfo' },
      { method: 'getaddressbalance', params: [{ addresses: [address] }] },
    ]);

    const tip = infoResult.result as { blocks: number };
    const balanceRaw = balanceResult.result as FiroAddressBalance;

    const allTxIds = await this.fetchTxIdsChunked(address, tip.blocks);

    if (!allTxIds.length) return;

    await this.addressModel.updateOne(
      { address },
      {
        $set: {
          address,
          data: {
            balance: balanceRaw.balance / SATOSHIS,
            received: balanceRaw.received / SATOSHIS,
            allTxIds,
          },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
      { upsert: true },
    );

    this.logger.debug(`Warmed address: ${address} (${allTxIds.length} txids)`);
  }

  private async fetchTxIdsChunked(address: string, tipHeight: number): Promise<string[]> {
    const collected: string[] = [];
    let end = tipHeight;

    while (end > 0 && collected.length < MAX_TX_IDS) {
      const start = Math.max(0, end - CHUNK_SIZE + 1);

      try {
        const chunk = await this.rpc.call<FiroAddressTxIds>('getaddresstxids', {
          addresses: [address],
          start,
          end,
        });

        if (chunk?.length) {
          for (let i = chunk.length - 1; i >= 0; i--) {
            collected.push(chunk[i]);
            if (collected.length >= MAX_TX_IDS) break;
          }
        }
      } catch (err) {
        this.logger.warn(`Chunk ${start}-${end} failed for ${address}: ${err}`);
      }

      end = start - 1;
    }

    return collected;
  }
}
