import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function initializeSocket(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  const token = getToken();
  
  socket = io(SOCKET_URL, {
    auth: {
      token: token || '',
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket.io connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.io disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Hook for React components
export function useSocket() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!socket || !socket.connected) {
    initializeSocket();
  }

  return socket;
}
