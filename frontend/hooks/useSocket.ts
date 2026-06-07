/**
 * useSocket.ts
 * Thin re-export — socket is now managed by SocketProvider (lib/socketContext.tsx).
 * Kept for backward compatibility.
 */

export { useSocketContext as useSocket } from '@/lib/socketContext';
