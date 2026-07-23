import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RpcModule } from '../rpc/rpc.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CachedAddress, CachedAddressSchema } from './address-sync.schema';
import { AddressSyncService } from './address-sync.service';

@Module({
  imports: [
    RpcModule,
    TransactionsModule,
    MongooseModule.forFeature([{ name: CachedAddress.name, schema: CachedAddressSchema }]),
  ],
  providers: [AddressSyncService],
  exports: [AddressSyncService],
})
export class AddressSyncModule {}
