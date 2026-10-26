import { Module } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Transport only: no gateway, rooms or messages until authenticated realtime is introduced. */
export class RealtimeAdapter extends IoAdapter {
  constructor(
    app: ConstructorParameters<typeof IoAdapter>[0],
    private readonly origin: string,
  ) {
    super(app);
  }
  override createIOServer(port: number, options: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origin, methods: ['GET', 'POST'] },
      maxHttpBufferSize: 16_384,
    });
  }
}

@Module({})
export class RealtimeModule {}
