import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Geo, GeoDocument } from './geo.schema';
import { MasternodeCache, MasternodeCacheDocument } from '../masternode/masternode.schema';
import { MmdbLoaderService } from './mmdb-loader.service';
import { MASTERNODE_CACHE_KEY } from '../constants';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly STALE_DAYS = 7;

  constructor(
    @InjectModel(Geo.name) private readonly geoModel: Model<GeoDocument>,
    @InjectModel(MasternodeCache.name)
    private readonly mnCacheModel: Model<MasternodeCacheDocument>,
    private readonly mmdb: MmdbLoaderService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncGeo(): Promise<void> {
    if (!this.mmdb.isReady()) {
      this.logger.warn('MMDB readers not ready, skipping geo sync');
      return;
    }

    const mnDoc = await this.mnCacheModel.findOne({ key: MASTERNODE_CACHE_KEY }).lean();
    if (!mnDoc) return;

    const rawIps = mnDoc.data.map((mn) => mn.state.service.split(':')[0]);
    const ips = [...new Set(rawIps.filter((ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)))];
    const existing = await this.geoModel.find({ ip: { $in: ips } }).lean();
    const existingMap = new Map(existing.map((e) => [e.ip, e]));

    const staleMs = this.STALE_DAYS * 24 * 60 * 60 * 1000;
    const toLookup = ips.filter((ip) => {
      const entry = existingMap.get(ip);
      return !entry || Date.now() - new Date(entry.lastFetched).getTime() > staleMs;
    });

    this.logger.debug(`Looking up geo for ${toLookup.length} IPs`);

    let ok = 0;
    let fail = 0;
    for (const ip of toLookup) {
      if (await this.lookupAndStore(ip)) ok++;
      else fail++;
    }

    this.logger.log(`Geo sync complete: ${ok} resolved, ${fail} failed`);
  }

  private async lookupAndStore(ip: string): Promise<boolean> {
    try {
      const country = this.mmdb.lookupCountry(ip);
      const asn = this.mmdb.lookupAsn(ip);

      if (!country?.country || country.country.iso_code === 'XX' || !asn) return false;

      await this.geoModel.updateOne(
        { ip },
        {
          ip,
          country: country.country.names.en,
          countryCode: country.country.iso_code,
          asn: asn.autonomous_system_number,
          org: asn.autonomous_system_organization || `ASN ${asn.autonomous_system_number}`,
          lastFetched: new Date(),
        },
        { upsert: true },
      );
      return true;
    } catch (err) {
      this.logger.error(`Geo lookup failed for ${ip}: ${err}`);
      return false;
    }
  }
}
