import {
  CachedTransaction,
  CachedTransactionSchema,
  RecentTransactionsCache,
  RecentTransactionsCacheSchema,
} from './transactions.schema';
import { RpcModule } from '../rpc/rpc.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    RpcModule,
    MongooseModule.forFeature([
      { name: CachedTransaction.name, schema: CachedTransactionSchema },
      {
        name: RecentTransactionsCache.name,
        schema: RecentTransactionsCacheSchema,
      },
    ]),
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
