import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SocketData, SocketUser } from '../types/socket.types';

interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Remove Bearer prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    const jwtSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      console.error('JWT_ACCESS_SECRET is not defined');
      return next(new Error('Authentication error: Server configuration error'));
    }

    const decoded = jwt.verify(cleanToken, jwtSecret) as any;

    if (!decoded || !decoded.userId) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Create socket user data
    const user: SocketUser = {
      id: decoded.userId,
      email: decoded.email || '',
      name: decoded.name || '',
      role: decoded.role || 'ADMIN'
    };

    // Attach user data to socket
    (socket as AuthenticatedSocket).data = { user };

    console.log(`Socket authenticated for user: ${user.name} (${user.email})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

export const requireAdminRole = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  const user = socket.data?.user;

  if (!user) {
    return next(new Error('Authorization error: User data not found'));
  }

  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];
  if (!adminRoles.includes(user.role)) {
    return next(new Error('Authorization error: Admin role required'));
  }

  next();
};