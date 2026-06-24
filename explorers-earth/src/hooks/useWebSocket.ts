// WebSocket hook for real-time playlist updates
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Resolve a secure WebSocket URL. On an https page the browser BLOCKS a ws://
// connection as mixed content, so default to wss:// and upgrade any ws:// / http://
// value (e.g. a stale env var) to its secure form. Exported for unit testing.
export function resolveWsUrl(envUrl: string | undefined, protocol: string): string {
  let url = envUrl || (protocol === 'https:' ? 'wss://localtunes.earth' : 'ws://localtunes.earth');
  if (protocol === 'https:') {
    url = url.replace(/^ws:\/\//, 'wss://').replace(/^http:\/\//, 'https://');
  }
  return url;
}

interface WebSocketOptions {
  enabled?: boolean;
  showConnectionToasts?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export const useWebSocket = (
  guestUrl: string,
  onMessage: (message: WebSocketMessage) => void,
  options: WebSocketOptions = {}
) => {
  const {
    enabled = true,
    showConnectionToasts: _showConnectionToasts = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !guestUrl) return;

    const connect = () => {
      try {
        const wsUrl = resolveWsUrl(
          import.meta.env.VITE_LOCAL_TUNES_WS_URL,
          typeof window !== 'undefined' ? window.location.protocol : 'https:'
        );
        console.log('🔌 Attempting WebSocket connection to:', wsUrl);
        console.log('🔌 Guest URL:', guestUrl);

        const socket = io(wsUrl, {
          query: { guestUrl },
          transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;

          // Process queued messages
          while (messageQueueRef.current.length > 0) {
            const message = messageQueueRef.current.shift();
            if (message) {
              onMessage(message);
            }
          }
        });

        socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
          console.warn('WebSocket connection failed (Local Tunes server may not support WebSocket):', error.message);
          setConnectionError(null); // Don't show error to user
          setIsConnected(false);
        });

        socket.on('message', (message: WebSocketMessage) => {
          if (isConnected) {
            onMessage(message);
          } else {
            // Queue message if not connected
            messageQueueRef.current.push(message);
          }
        });

        socketRef.current = socket;
      } catch (error) {
        console.warn('Failed to create WebSocket connection (Local Tunes server may not support WebSocket):', error);
        setConnectionError(null); // Don't show error to user
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setConnectionError(null);
    };
  }, [enabled, guestUrl, onMessage]);

  // Send message function
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message', message);
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, [isConnected]);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < reconnectAttempts) {
      reconnectAttemptsRef.current++;
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, reconnectDelay * reconnectAttemptsRef.current);
    }
  }, [reconnectAttempts, reconnectDelay]);

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect,
    socket: socketRef.current,
  };
};
