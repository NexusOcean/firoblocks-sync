import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Reader, open, CountryResponse, AsnResponse } from 'maxmind';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class MmdbLoaderService implements OnModuleInit {
  private readonly logger = new Logger(MmdbLoaderService.name);
  private readonly LOCAL_DIR = '/tmp/geoip';
  private readonly COUNTRY_URL = process.env.GEOIP_COUNTRY_URL!;
  private readonly ASN_URL = process.env.GEOIP_ASN_URL!;

  private countryReader: Reader<CountryResponse> | null = null;
  private asnReader: Reader<AsnResponse> | null = null;

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.LOCAL_DIR, { recursive: true });
    await this.refresh();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refresh(): Promise<void> {
    try {
      const [countryPath, asnPath] = await Promise.all([
        this.download(this.COUNTRY_URL, 'GeoLite2-Country.mmdb'),
        this.download(this.ASN_URL, 'GeoLite2-ASN.mmdb'),
      ]);

      const [newCountry, newAsn] = await Promise.all([
        open<CountryResponse>(countryPath),
        open<AsnResponse>(asnPath),
      ]);

      this.countryReader = newCountry;
      this.asnReader = newAsn;

      this.logger.debug('MMDB readers refreshed');
    } catch (err) {
      this.logger.error(`MMDB refresh failed: ${err}`);
    }
  }

  private async download(url: string, filename: string): Promise<string> {
    const path = join(this.LOCAL_DIR, filename);
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });
    await fs.writeFile(path, Buffer.from(res.data));
    return path;
  }

  lookupCountry(ip: string): CountryResponse | null {
    return this.countryReader?.get(ip) ?? null;
  }

  lookupAsn(ip: string): AsnResponse | null {
    return this.asnReader?.get(ip) ?? null;
  }

  isReady(): boolean {
    return this.countryReader !== null && this.asnReader !== null;
  }
}
