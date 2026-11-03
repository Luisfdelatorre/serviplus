import { io } from 'socket.io-client';

// En desarrollo usamos el proxy o ventana actual, en producción la raíz
const SOCKET_URL = window.location.origin;

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('[Socket.io React] Conectado exitosamente:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.warn('[Socket.io React] Desconectado:', reason);
});
