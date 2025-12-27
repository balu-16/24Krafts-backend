import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(url?: string) {
    const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.pubClient = createClient({ url: redisUrl });
      this.subClient = this.pubClient.duplicate();
      await this.pubClient.connect();
      await this.subClient.connect();
      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      // eslint-disable-next-line no-console
      console.log(`✅ Connected Redis adapter at ${redisUrl}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ Redis unavailable, falling back to default Socket.IO adapter:', (err as any)?.message || err);
      this.adapterConstructor = undefined;
    }
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: (origin: string, callback: Function) => {
          const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim());
          const isProd = process.env.NODE_ENV === 'production';
          if (!origin && !isProd) return callback(null, true);
          if (origin && (allowedOrigins.includes(origin) || (!isProd && allowedOrigins.includes('*')))) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
      },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}