import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth.middleware';

let io: Server | undefined;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = verifyToken(token);
        socket.data.userId = decoded.userId;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);
    
    // Join a room specific to the user so we can emit events to them
    if (userId) {
        socket.join(userId);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
    try {
        getIO().to(userId).emit(event, data);
    } catch (e) {
        // Socket might not be init if server starting up
        console.warn('Socket emit failed:', e);
    }
}
