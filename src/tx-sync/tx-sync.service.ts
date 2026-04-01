import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransactionsService } from '../transactions/transactions.service';
import { AddressSyncService } from '../address-sync/address-sync.service';

@Injectable()
export class TransactionSyncService {
  private readonly logger = new Logger(TransactionSyncService.name);
  private running = false;

  constructor(
    private readonly txService: TransactionsService,
    private readonly addressSyncService: AddressSyncService,
  ) {}

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

      const addresses = new Set<string>();
      for (const tx of txs) {
        for (const vout of tx.vout) {
          for (const addr of vout.addresses) addresses.add(addr);
        }
        for (const vin of tx.vin) {
          if (vin.address) addresses.add(vin.address);
        }
      }

      for (const address of addresses) {
        await this.addressSyncService
          .warmAddress(address)
          .catch((err) => this.logger.warn(`Failed to warm address ${address}: ${err.message}`));
      }

      this.logger.log(`Warmed ${addresses.size} addresses from recent transactions`);
    } catch (err) {
      this.logger.error(`warmRecentTransactions failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
