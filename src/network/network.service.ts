import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { RpcService } from '../rpc/rpc.service';
import { HealthService } from '../health/health.service';
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

const UTXO_TASK = 'syncUtxoStats';
const CHAIN_TASK = 'syncChainStats';

@Injectable()
export class NetworkStatsService implements OnModuleInit {
  private readonly logger = new Logger(NetworkStatsService.name);
  private utxoRunning = false;
  private chainRunning = false;

  constructor(
    @InjectModel(NetworkStats.name)
    private readonly statsModel: Model<NetworkStatsDocument>,
    private readonly rpc: RpcService,
    private readonly health: HealthService,
  ) {}

  onModuleInit() {
    this.health.register(UTXO_TASK, 60 * 60 * 1000);
    this.health.register(CHAIN_TASK, 3 * 60 * 1000);
  }

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

      this.logger.debug(`syncUtxoStats complete — height ${info.height}`);
      this.health.beat(UTXO_TASK);
    } catch (err) {
      this.logger.error(`syncUtxoStats failed: ${err}`);
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
      const [chainResult, hashrateResult] = await this.rpc.batch([
        { method: 'getblockchaininfo' },
        { method: 'getnetworkhashps' },
      ]);

      const chainInfo = chainResult.result as BlockchainInfo;
      const hashrate = hashrateResult.result as number;

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

      this.logger.debug(`syncChainStats complete — difficulty ${chainInfo.difficulty}`);
      this.health.beat(CHAIN_TASK);
    } catch (err) {
      this.logger.error(`syncChainStats failed: ${err}`);
    } finally {
      this.chainRunning = false;
    }
  }
}
