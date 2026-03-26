import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { TransactionSyncService } from './tx-sync.service';

@Module({
  imports: [TransactionsModule],
  providers: [TransactionSyncService],
})
export class TransactionSyncModule {}
