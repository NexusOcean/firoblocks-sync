import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class TransactionSyncService {
  private readonly logger = new Logger(TransactionSyncService.name);
  private running = false;

  constructor(private readonly txService: TransactionsService) {}

  @Cron('*/60 * * * * *')
  async warmRecentTransactions() {
    if (this.running) {
      this.logger.warn('warmRecentTransactions already running, skipping tick');
      return;
    }

    this.running = true;
    try {
      const txs = await this.txService.getRecentTransactions(10);
      await this.txService.saveRecentTransactions(txs);
      this.logger.log('Recent transactions cache warmed');
    } catch (err) {
      this.logger.error(`warmRecentTransactions failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }
}
