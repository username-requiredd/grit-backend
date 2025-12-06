// guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. What roles are required on this handler/class?
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(), 
    ]);

    // If no @Roles() decorator → allow (we'll make admin routes explicit)
    if (!requiredRoles) {
      return true;
    }

    // 2. Who is the current user?
    const { user } = context.switchToHttp().getRequest();

    // 3. Does the user have at least one of the required roles?
    const hasRole = requiredRoles.some((role) => user?.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required role');
    }

    return true;
  }
}