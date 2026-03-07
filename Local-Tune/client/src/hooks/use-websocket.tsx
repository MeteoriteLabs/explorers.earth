import { useEffect, useRef, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';

interface WebSocketMessage {
  type: 'SONG_REQUESTS_TOGGLE' | 'GUEST_PLAY_TOGGLE' | 'PLAYLIST_SHARING_TOGGLE' | 'PLAYLIST_UPDATE' | 'CONNECTION_STATUS' | 'ERROR' | 'player_state' | 'THEME_UPDATE' | 'RECENTLY_PLAYED_TOGGLE';
  payload?: any;
  status?: string;
  message?: string;
  room?: string;
  playing?: boolean;
}

interface WebSocketOptions {
  enabled?: boolean;
  showConnectionToasts?: boolean;
}

// Helper to check if something is a Promise-like object
const isPromiseLike = (value: any): value is Promise<unknown> => {
  return value && typeof value === 'object' && typeof value.then === 'function' && typeof value.catch === 'function';
}

// Define a more flexible callback type that can return void or a Promise
type MessageHandler = (message: WebSocketMessage) => void | Promise<void>;

export function useWebSocket(
  guestUrl: string | undefined, 
  onMessage: MessageHandler,
  options: WebSocketOptions = { enabled: true, showConnectionToasts: true }
) {
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const lastToastRef = useRef<number>(0);
  const reconnectAttempts = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const messageProcessingRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Helper function to prevent toast spam
  const showToast = useCallback((message: { title?: string; description: string; variant?: "default" | "destructive" }) => {
    const now = Date.now();
    if (now - lastToastRef.current > 5000) {
      toast(message);
      lastToastRef.current = now;
    }
  }, [toast]);

  // Clear message queue and stop processing
  const clearMessageQueue = useCallback(() => {
    if (messageProcessingRef.current) {
      clearTimeout(messageProcessingRef.current);
      messageProcessingRef.current = null;
    }
    messageQueueRef.current = [];
  }, []);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    if (isUnmountingRef.current || !socketRef.current?.connected) {
      return;
    }

    try {
      if (messageQueueRef.current.length > 0 && socketRef.current?.connected) {
        const message = messageQueueRef.current.shift();
        if (message) {
          // Use a Promise to handle the emit operation safely
          Promise.resolve().then(() => {
            if (socketRef.current?.connected) {
              socketRef.current.emit('message', message);
            } else {
              // Re-queue the message if we're suddenly disconnected
              messageQueueRef.current.unshift(message);
            }
          }).catch(error => {
            console.error('Error sending message:', error);
            // Re-queue the failed message at the front
            messageQueueRef.current.unshift(message);
          });
        }
      }

      // Schedule next processing if still connected and not unmounting
      if (!isUnmountingRef.current && socketRef.current?.connected) {
        messageProcessingRef.current = setTimeout(processMessageQueue, 100);
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
      // The processing will retry on next scheduled interval
    }
  }, []);

  // Cleanup function with improved error handling and resource management
  const cleanup = useCallback(() => {
    // First, clear the message queue and stop processing
    clearMessageQueue();
    
    // Then handle the socket cleanup
    if (socketRef.current) {
      try {
        const socket = socketRef.current;
        
        // Remove all listeners to prevent memory leaks
        socket.off('connect');
        socket.off('message');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('error');
        socket.off('reconnect');
        socket.off('reconnect_attempt');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');
        
        // Cleanly disconnect if still connected
        if (socket.connected) {
          socket.disconnect();
        }
        
        // Clear the reference
        socketRef.current = null;
      } catch (error) {
        console.error('Error during socket cleanup:', error);
      }
    }
    
    // Reset state
    setConnectionError(null);
    reconnectAttempts.current = 0;
  }, [clearMessageQueue]);

  // Connect function
  const connect = useCallback(() => {
    // Verify guestUrl is valid before attempting to connect
    // A valid guestUrl should be 32 characters long and contain only alphanumeric chars
    const isValidGuestUrl = guestUrl && 
      /^[a-z0-9]{32}$/i.test(guestUrl) && 
      guestUrl !== 'eb264ff42b17356d5b3c94b0d78f2684'; // Explicitly block the problematic URL
    
    if (!isValidGuestUrl || !options.enabled || isConnectingRef.current) {
      if (guestUrl && !isValidGuestUrl) {
        console.warn(`Prevented WebSocket connection with invalid guestUrl: ${guestUrl}`);
      }
      return;
    }

    try {
      isConnectingRef.current = true;
      cleanup();

      const socket = io('/', {
        path: '/ws',
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000, // Maximum reconnection delay of 10 seconds
        reconnectionAttempts: 10,    // Increased from 5 to 10
        randomizationFactor: 0.5,    // Add randomization to prevent connection storms
        timeout: 20000,              // Increase timeout for slower connections
        query: { guestUrl },
        transports: ['websocket', 'polling'] // Allow fallback to polling if WebSockets fail
      });

      socket.on('connect', () => {
        if (!isUnmountingRef.current) {
          console.log('Socket.IO connected successfully');
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
          if (options.showConnectionToasts) {
            showToast({
              description: "Connected to playlist server"
            });
          }
        }
      });

      // Improved message handler with better promise management
      socket.on('message', (message: WebSocketMessage) => {
        if (isUnmountingRef.current) {
          // Skip message handling entirely if we're unmounting
          console.debug('Skipping message handler for unmounting component');
          return;
        }
        
        try {
          // Create a local closure to keep a reference to mounted state
          const isComponentMounted = () => !isUnmountingRef.current;
          
          // Process the message with error handling
          const result = onMessage(message);
          
          // Handle promise-based responses with proper cleanup
          if (isPromiseLike(result)) {
            // This fixes the "message channel closed" error by properly
            // catching and handling any promises that might resolve after unmount
            result
              .then(() => {
                if (!isComponentMounted()) {
                  console.debug('Async message handler completed after component unmounted');
                }
              })
              .catch(error => {
                // Properly handle promise rejections with component state context
                if (isComponentMounted()) {
                  console.error('Async message handler error:', error);
                } else {
                  // More graceful handling for errors after unmount
                  console.debug('Async message handler error after unmount:', error.message);
                }
              });
          }
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });

      socket.on('disconnect', (reason: string) => {
        if (!isUnmountingRef.current) {
          console.log('Socket.IO disconnected:', reason);
          setIsConnected(false);
          clearMessageQueue();

          if (options.showConnectionToasts) {
            showToast({
              title: "Disconnected",
              description: "Connection closed by server",
              variant: "destructive"
            });
          }
        }
      });

      socket.on('connect_error', (error: Error) => {
        if (!isUnmountingRef.current) {
          console.error('Socket.IO connection error:', error);
          setIsConnected(false);
          setConnectionError(error.message);
          clearMessageQueue();

          // Count failed attempts but let Socket.IO handle reconnection
          reconnectAttempts.current++;
          
          // Only show a toast on first error or when we reach the maximum attempts
          if (reconnectAttempts.current === 1 || reconnectAttempts.current >= 10) {
            if (options.showConnectionToasts) {
              showToast({
                title: reconnectAttempts.current >= 10 ? "Connection Failed" : "Connection Error",
                description: reconnectAttempts.current >= 10 
                  ? "Could not connect to server after multiple attempts" 
                  : "Attempting to reconnect...",
                variant: "destructive"
              });
            }
            
            // If we've reached max attempts, disconnect manually
            if (reconnectAttempts.current >= 10) {
              socket.disconnect();
            }
          }
        }
      });

      // Add generic error handler for any uncaught socket errors
      socket.on('error', (error: Error) => {
        console.error('Socket.IO general error:', error);
        if (!isUnmountingRef.current) {
          setConnectionError(error.message);
        }
      });

      // Listen for reconnection events to provide better user feedback
      socket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log(`Socket.IO reconnection attempt ${attemptNumber}`);
      });

      socket.on('reconnect', (attemptNumber: number) => {
        console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
        if (!isUnmountingRef.current) {
          setConnectionError(null);
          reconnectAttempts.current = 0;
        }
      });

      socketRef.current = socket;

      // Start processing message queue
      if (!messageProcessingRef.current) {
        messageProcessingRef.current = setTimeout(processMessageQueue, 100);
      }

    } catch (error) {
      console.error('Error setting up Socket.IO:', error);
      setConnectionError('Failed to set up connection');
      setIsConnected(false);
    } finally {
      isConnectingRef.current = false;
    }
  }, [guestUrl, onMessage, showToast, options.enabled, options.showConnectionToasts, cleanup, clearMessageQueue, processMessageQueue]);

  useEffect(() => {
    isUnmountingRef.current = false;
    connect();

    return () => {
      isUnmountingRef.current = true;
      cleanup();
    };
  }, [connect, cleanup]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Create an abort controller to cancel pending operations if component unmounts
    const abortController = new AbortController();
    
    if (isUnmountingRef.current) {
      // Don't queue messages if we're unmounting
      console.warn('Attempted to send message while component is unmounting:', message);
      return;
    }
    
    // Use a promise-based approach with error handling and abort signal
    Promise.resolve().then(() => {
      // Check for abort/unmount before proceeding
      if (abortController.signal.aborted || isUnmountingRef.current) {
        return;
      }
      
      // Queue message regardless of connection state
      messageQueueRef.current.push(message);
      
      // If disconnected, warn but still queue the message for future delivery
      if (!socketRef.current?.connected) {
        console.warn('Message queued while disconnected - will send when reconnected:', message);
      }
      
      // If connected but not processing queue, start processing
      if (socketRef.current?.connected && !messageProcessingRef.current) {
        messageProcessingRef.current = setTimeout(() => {
          // Check again if we're unmounting before starting message processing
          if (!isUnmountingRef.current) {
            processMessageQueue();
          }
        }, 50);
      }
    }).catch(error => {
      // This should rarely happen but provides a safety net
      console.error('Error in send message operation:', error);
    });
    
    // Set up cleanup if component unmounts
    return () => {
      abortController.abort();
    };
  }, [processMessageQueue]);

  return { 
    sendMessage,
    isConnected,
    connectionError 
  };
}