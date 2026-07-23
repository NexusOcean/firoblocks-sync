import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { AddressSyncModule } from '../address-sync/address-sync.module';
import { TransactionSyncService } from './tx-sync.service';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [TransactionsModule, AddressSyncModule, HealthModule],
  providers: [TransactionSyncService],
})
export class TransactionSyncModule {}
