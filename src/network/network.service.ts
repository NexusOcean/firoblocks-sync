import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import { NetworkStats, NetworkStatsDocument } from './network.schema';

interface TxOutSetInfo {
  height: number;
  transactions: number;
  total_amount: number;
}

interface BlockchainInfo {
  blocks: number;
  difficulty: number;
  bestblockhash: string;
}

@Injectable()
export class NetworkStatsService {
  private readonly logger = new Logger(NetworkStatsService.name);
  private utxoRunning = false;
  private chainRunning = false;

  constructor(
    @InjectModel(NetworkStats.name)
    private readonly statsModel: Model<NetworkStatsDocument>,
    private readonly rpc: RpcService,
  ) {}

  @Cron('0 */15 * * * *')
  async syncUtxoStats() {
    if (this.utxoRunning) {
      this.logger.warn('syncUtxoStats already running, skipping tick');
      return;
    }

    this.utxoRunning = true;
    try {
      this.logger.log('Running gettxoutsetinfo...');
      const info = await this.rpc.call<TxOutSetInfo>('gettxoutsetinfo');

      await this.statsModel.updateOne(
        { chain: 'main', type: 'utxo' },
        {
          $set: {
            height: info.height,
            transactions: info.transactions,
            totalSupply: info.total_amount,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.log(`syncUtxoStats complete — height ${info.height}`);
    } catch (err) {
      this.logger.error(`syncUtxoStats failed: ${err.message}`);
    } finally {
      this.utxoRunning = false;
    }
  }

  @Cron('*/30 * * * * *')
  async syncChainStats() {
    if (this.chainRunning) {
      this.logger.warn('syncChainStats already running, skipping tick');
      return;
    }

    this.chainRunning = true;
    try {
      const [chainInfo, hashrate] = await Promise.all([
        this.rpc.call<BlockchainInfo>('getblockchaininfo'),
        this.rpc.call<number>('getnetworkhashps'),
      ]);

      await this.statsModel.updateOne(
        { chain: 'main', type: 'chain' },
        {
          $set: {
            height: chainInfo.blocks,
            difficulty: chainInfo.difficulty,
            bestBlockHash: chainInfo.bestblockhash,
            hashrate,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.log(`syncChainStats complete — difficulty ${chainInfo.difficulty}`);
    } catch (err) {
      this.logger.error(`syncChainStats failed: ${err.message}`);
    } finally {
      this.chainRunning = false;
    }
  }
}
