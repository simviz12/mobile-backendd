import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from '../../../shared/errors/app-error.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, _context: ExecutionContext) {
    if (info?.name === 'TokenExpiredError') {
      throw new AppError(
        'ACCESS_TOKEN_EXPIRED',
        'Access token has expired',
        401,
      );
    }

    if (err || !user) {
      throw new AppError(
        'UNAUTHORIZED',
        'Authentication required or invalid token',
        401,
      );
    }

    return user;
  }
}
