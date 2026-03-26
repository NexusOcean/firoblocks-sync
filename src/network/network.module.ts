import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NetworkStats, NetworkStatsSchema } from './network.schema';
import { NetworkStatsService } from './network.service';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NetworkStats.name, schema: NetworkStatsSchema }]),
    RpcModule,
  ],
  providers: [NetworkStatsService],
})
export class NetworkStatsModule {}
