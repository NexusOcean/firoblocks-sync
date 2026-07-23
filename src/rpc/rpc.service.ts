import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createFiroRpcClient,
  FiroRpcClient,
  RpcCallError,
  BatchCall,
  BatchResult,
} from '@nexusocean/firo-rpc';

@Injectable()
export class RpcService {
  private readonly client: FiroRpcClient;
  private readonly logger = new Logger(RpcService.name);

  constructor(config: ConfigService) {
    this.client = createFiroRpcClient({
      host: config.get<string>('FIRO_RPC_HOST') || 'localhost',
      port: config.get<number>('FIRO_RPC_PORT') || 8888,
      user: config.get<string>('FIRO_RPC_USER') || '',
      pass: config.get<string>('FIRO_RPC_PASS') || '',
      protocol: config.get<'http' | 'https'>('FIRO_RPC_PROTOCOL'),
      timeout: 10_000,
      axiosOptions: {
        maxContentLength: 30 * 1024 * 1024,
        maxBodyLength: 30 * 1024 * 1024,
      },
    });
  }

  async call<T>(method: string, ...params: unknown[]): Promise<T> {
    try {
      return await this.client.call<T>(method, ...params);
    } catch (err) {
      if (err instanceof RpcCallError) {
        this.logger.error(`RPC [${method}] error ${err.code}: ${err.message}`);
        throw new InternalServerErrorException(`RPC error: ${err.message}`);
      }
      throw err;
    }
  }

  async batch(calls: BatchCall[]): Promise<BatchResult[]> {
    try {
      return await this.client.batch(calls);
    } catch (err) {
      if (err instanceof RpcCallError) {
        this.logger.error(`RPC batch failed: ${err.message}`);
        throw new InternalServerErrorException(`RPC batch error: ${err.message}`);
      }
      throw err;
    }
  }
}
