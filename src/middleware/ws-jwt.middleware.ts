// src/common/ws-jwt.middleware.ts
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

export const WsJwtMiddleware = (jwtService: JwtService) => {
  return (client: Socket, next: (err?: Error) => void) => {
    const token = client.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      // Disconnect the socket connection immediately
      return next(new UnauthorizedException('No token provided'));
    }

    try {
      const payload = jwtService.verify(token, {
        secret: process.env.SUPABASE_JWT_SECRET,
      });

      // 🔑 CRITICAL: Attach the user payload here for global access
      client.data.user = payload; 
      
      next(); // Authentication successful
    } catch (error) {
      // Disconnect the socket connection immediately
      return next(new UnauthorizedException('Invalid token'));
    }
  };
};