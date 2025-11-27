import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface UserPayload {
  userId: string;
  username: string;
  [key: string]: any;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateToken(token: string): Promise<UserPayload> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return {
        userId: payload.userId || payload.sub || payload.id,
        username: payload.username || payload.name || payload.email,
        ...payload,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  extractTokenFromHeader(authorization: string | undefined): string | null {
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
