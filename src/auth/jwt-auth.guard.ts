// src/auth/jwt-auth.guard.ts
import { 
    ExecutionContext, 
    Injectable, 
    UnauthorizedException,
    Logger 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtAuthGuard.name);

    constructor(private jwtService: JwtService) {
        super();
    }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        // Use the default HTTP flow if not a WebSocket request
        if (context.getType() !== 'ws') {
            return super.canActivate(context);
        }

        // Handle WebSocket authentication flow
        return this.canActivateWebSocket(context);
    }

    /**
     * Handles authentication for WebSocket events (@SubscribeMessage).
     * The initial socket connection still requires handling in BoardGateway.handleConnection.
     */
    canActivateWebSocket(context: ExecutionContext): boolean {
        const client = context.switchToWs().getClient<Socket>();
        
        // FIX: Extract the token from the Socket.IO 'auth' payload
        const token = client.handshake.auth?.token as string;

        if (!token) {
            this.logger.warn('WS Auth failed: No token provided in handshake');
            // Do NOT disconnect here. The initial connection handler (handleConnection)
            // should manage the final disconnect, but we throw the exception.
            throw new UnauthorizedException('No token provided');
        }

        try {
            // FIX: Use jwtService.verify() without manually providing the secret.
            // The service already knows the secret from JwtModule.registerAsync().
            const payload = this.jwtService.verify(token); 
            
            // Store the decoded user data on the socket for downstream handlers
            // This allows you to access client.data.user in @SubscribeMessage methods.
            client.data.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
            };
            
            return true;
        } catch (error) {
            this.logger.error('WS Auth failed: Invalid token', error.message);
            throw new UnauthorizedException('Invalid token');
        }
    }

    // handleRequest remains for the HTTP passport strategy flow
    handleRequest<TUser = any>(
        err: any,
        user: any,
        info: any,
        context: ExecutionContext,
    ): TUser {
        // Only run for HTTP context
        if (context.getType() === 'http') {
            if (err || !user) {
                // ... (standard HTTP error handling logic remains here)
                const request = context.switchToHttp().getRequest();
                const errorMessage = info?.message || err?.message || 'Unauthorized';
                
                this.logger.error('HTTP Auth failed:', {
                    path: request.url,
                    method: request.method,
                    error: err?.message,
                });
                throw new UnauthorizedException(errorMessage);
            }
        }
        
        return user;
    }
}
