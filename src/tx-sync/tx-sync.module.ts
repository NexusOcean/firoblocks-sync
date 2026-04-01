import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { AddressSyncModule } from '../address-sync/address-sync.module';
import { TransactionSyncService } from './tx-sync.service';

@Module({
  imports: [TransactionsModule, AddressSyncModule],
  providers: [TransactionSyncService],
})
export class TransactionSyncModule {}
