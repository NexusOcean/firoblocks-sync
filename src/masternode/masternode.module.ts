import { Module } from '@nestjs/common';
import { MasternodeService } from './masternode.service';
import { RpcModule } from '../rpc/rpc.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MasternodeCache, MasternodeCacheSchema } from './masternode.schema';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [
    RpcModule,
    GeoModule,
    MongooseModule.forFeature([{ name: MasternodeCache.name, schema: MasternodeCacheSchema }]),
  ],
  controllers: [],
  providers: [MasternodeService],
})
export class MasternodeModule {}
