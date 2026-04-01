import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { RpcModule } from './rpc/rpc.module';
import { NetworkStatsModule } from './network/network.module';
import { TransactionSyncModule } from './tx-sync/tx-sync.module';
import { AddressSyncModule } from './address-sync/address-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: 'firo_explorer',
      }),
    }),
    ScheduleModule.forRoot(),
    RpcModule,
    NetworkStatsModule,
    TransactionSyncModule,
    AddressSyncModule,
  ],
})
export class AppModule {}
