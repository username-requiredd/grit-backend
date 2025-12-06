// src/board/board.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger,UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { JwtService } from '@nestjs/jwt'; // <-- NEW: Imported JwtService

interface MoveCardPayload {
  cardId: string;
  toColumnId: string;
  toPosition: number;
  boardId: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://your-frontend.vercel.app'],
    credentials: true,
  },
  pingTimeout: 60000,
})
export class BoardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('BoardGateway');
  private pubClient: Redis;
  private subClient: Redis;

  // CONSTRUCTOR: Inject both Prisma and JwtService
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService, // <-- INJECTED JWT SERVICE
  ) {}

  // AFTERINIT: Redis Connection Logic (Fix for Upstash/TLS)
  async afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');

    const redisUrl = process.env.UPSTASH_REDIS_URL;

    if (!redisUrl) {
      this.logger.warn(
        'UPSTASH_REDIS_URL not set - running in single-instance mode (no Redis scaling)',
      );
      return;
    }

    try {
      // FIX: Use the URL string directly and configure TLS for Upstash
      const options = {
        maxRetriesPerRequest: null, // Essential for Socket.io adapter
        tls: redisUrl.startsWith('rediss://')
          ? { rejectUnauthorized: true }
          : undefined,
        enableReadyCheck: false,
        connectTimeout: 20000,
        keepAlive: 30000,
      };

      this.pubClient = new Redis(redisUrl, options);
      this.subClient = new Redis(redisUrl, options);

      // Error Logging
      this.pubClient.on('error', (err) =>
        this.logger.error(`Redis Pub Error: ${err.message}`),
      );
      this.subClient.on('error', (err) =>
        this.logger.error(`Redis Sub Error: ${err.message}`),
      );

      // Wait for connections to be 'ready'
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          this.pubClient.once('ready', resolve);
          this.pubClient.once('error', reject);
          setTimeout(() => reject(new Error('Pub Client Timeout')), 10000);
        }),
        new Promise<void>((resolve, reject) => {
          this.subClient.once('ready', resolve);
          this.subClient.once('error', reject);
          setTimeout(() => reject(new Error('Sub Client Timeout')), 10000);
        }),
      ]);

      this.logger.log('✓ Redis connected successfully');

      server.adapter(createAdapter(this.pubClient, this.subClient));
      this.logger.log('✓ Redis adapter attached — real-time works across instances');
    } catch (err) {
      this.logger.error('Failed to connect to Redis:', err.message);
      this.logger.warn(
        '⚠ Running without Redis - WebSocket will work in single-instance mode only',
      );

      // Clean up failed connections
      if (this.pubClient) this.pubClient.disconnect();
      if (this.subClient) this.subClient.disconnect();
    }
  }

  // HANDLECONNECTION: Initial Handshake & User Population
  async handleConnection(client: Socket) {
    try {
      // 1. Get token from frontend 'auth' payload
      const token = client.handshake.auth?.token as string;

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // 2. Decode and Populate client.data.user
      // This is crucial for the JwtAuthGuard to run on subsequent events
      const payload = this.jwtService.verify(token);
      client.data.user = { 
        id: payload.sub, // Use 'sub' for Supabase user ID
        email: payload.email,
      };

      this.logger.log(
        `Client connected: ${client.id} (User: ${client.data.user.id})`,
      );
    } catch (error) {
      this.logger.warn('Connection rejected: Invalid Token or Auth Failed');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // HANDLEJOINBOARD: Protected by Guard
  @UseGuards(JwtAuthGuard) // <-- GUARD PROTECTS THIS EVENT
  @SubscribeMessage('joinBoard')
  async handleJoinBoard(
    @MessageBody() boardId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // User is guaranteed to exist by the guard
    const userId = client.data.user.id; 

    // Security: check if user has access to this board
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: { boards: { some: { id: boardId } } },
      },
    });

    if (!membership) {
      client.emit('error', { message: 'Access denied to board' });
      return;
    }

    client.join(`board_${boardId}`);
    this.logger.log(`User ${userId} joined board_${boardId}`);
  }

  // HANDLEMOVECARD: Protected by Guard
  @UseGuards(JwtAuthGuard) // <-- GUARD PROTECTS THIS EVENT
  @SubscribeMessage('moveCard')
  async handleMoveCard(
    @MessageBody() payload: MoveCardPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { cardId, toColumnId, toPosition, boardId } = payload;
    // User is guaranteed to exist by the guard
    const userId = client.data.user.id; 

    // Validate that user has permission to modify this board
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: { boards: { some: { id: boardId } } },
      },
    });

    if (!membership) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    // Update in DB
    await this.prisma.card.update({
      where: { id: cardId },
      data: {
        columnId: toColumnId,
        position: toPosition,
      },
    });

    // Broadcast to everyone in the board room
    this.server.to(`board_${boardId}`).emit('cardMoved', {
      cardId,
      toColumnId,
      toPosition,
      movedBy: userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Card ${cardId} moved by ${userId}`);
  }

  // Clean up Redis connections on module destroy
  async onModuleDestroy() {
    if (this.pubClient) {
      this.pubClient.disconnect();
    }
    if (this.subClient) {
      this.subClient.disconnect();
    }
    this.logger.log('Redis connections closed');
  }
}
