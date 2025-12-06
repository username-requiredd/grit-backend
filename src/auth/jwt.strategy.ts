import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // User ID
  email?: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  user_metadata?: Record<string, any>;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
 constructor(private configService: ConfigService) {
  const supabaseUrl = process.env.SUPABASE_URL; // Fixed typo
  const jwtSecret = process.env.SUPABASE_JWT_SECRET_KEY;
  
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET_KEY is not defined');
  }
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not defined');
  }
  
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: jwtSecret,
    audience: 'authenticated',
    issuer: `${supabaseUrl}/auth/v1`, // Verify this format with your actual JWT
    algorithms: ['HS256'],
  });
}

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload: missing user ID');
    }

    // Validate audience
    if (payload.aud !== 'authenticated') {
      throw new UnauthorizedException('Invalid token audience');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'authenticated',
      metadata: payload.user_metadata,
    };
  }
}