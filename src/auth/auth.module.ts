// src/auth/auth.module.ts

import { Module, Global } from '@nestjs/common'; // Added Global (optional but helpful)
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt'; 
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

// @Global() // Optional: Uncommenting this makes AuthModule available everywhere without importing it.
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SUPABASE_JWT_SECRET_KEY'),
        signOptions: {
          expiresIn: '1h', 
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  providers: [JwtStrategy, JwtAuthGuard],
  // ⬇️ FIX: Export JwtModule to make JwtService available to other modules ⬇️
  exports: [
    JwtAuthGuard, 
    PassportModule,
    JwtModule, // <--- CRITICAL FIX: Add this line!
  ],
})
export class AuthModule {}