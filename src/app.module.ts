import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { RpcModule } from './rpc/rpc.module';
import { NetworkStatsModule } from './network/network.module';
import { TransactionSyncModule } from './tx-sync/tx-sync.module';
import { AddressSyncModule } from './address-sync/address-sync.module';
import { MasternodeModule } from './masternode/masternode.module';
import { GeoModule } from './geo/geo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: 'firo_blocks',
        minPoolSize: 5,
        maxPoolSize: 20,
        socketTimeoutMS: 120_000,
        waitQueueTimeoutMS: 5_000,
        serverSelectionTimeoutMS: 30_000,
      }),
    }),
    ScheduleModule.forRoot(),
    RpcModule,
    NetworkStatsModule,
    TransactionSyncModule,
    AddressSyncModule,
    MasternodeModule,
    GeoModule,
  ],
})
export class AppModule {}
