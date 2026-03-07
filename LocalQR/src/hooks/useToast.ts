import { toast as sonnerToast } from "sonner";
import { useRef, useCallback } from "react";

interface ToastOptions {
  id?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Global toast state to track shown toasts
const shownToasts = new Set<string>();

export const useToast = () => {
  const toastIdRef = useRef<string | null>(null);

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const toastId = options?.id || `toast-${Date.now()}-${Math.random()}`;
    
    // Check if this specific toast has already been shown
    if (shownToasts.has(toastId)) {
      return;
    }

    // Mark this toast as shown
    shownToasts.add(toastId);
    toastIdRef.current = toastId;

    // Show the toast with appropriate variant
    const toastFunction = options?.variant === 'destructive' ? sonnerToast.error :
                         options?.variant === 'success' ? sonnerToast.success :
                         sonnerToast;

    toastFunction(message, {
      id: toastId,
      duration: options?.duration || 4000,
      onDismiss: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      onAutoClose: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      action: options?.action,
    });
  }, []);

  const toastSuccess = useCallback((message: string, options?: ToastOptions) => {
    const toastId = options?.id || `success-${Date.now()}-${Math.random()}`;
    
    if (shownToasts.has(toastId)) {
      return;
    }

    shownToasts.add(toastId);
    toastIdRef.current = toastId;

    sonnerToast.success(message, {
      id: toastId,
      duration: options?.duration || 4000,
      onDismiss: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      onAutoClose: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      action: options?.action,
    });
  }, []);

  const toastError = useCallback((message: string, options?: ToastOptions) => {
    const toastId = options?.id || `error-${Date.now()}-${Math.random()}`;
    
    if (shownToasts.has(toastId)) {
      return;
    }

    shownToasts.add(toastId);
    toastIdRef.current = toastId;

    sonnerToast.error(message, {
      id: toastId,
      duration: options?.duration || 5000,
      onDismiss: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      onAutoClose: () => {
        shownToasts.delete(toastId);
        toastIdRef.current = null;
      },
      action: options?.action,
    });
  }, []);

  const dismissToast = useCallback(() => {
    if (toastIdRef.current) {
      sonnerToast.dismiss(toastIdRef.current);
      shownToasts.delete(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, []);

  const clearAllToasts = useCallback(() => {
    sonnerToast.dismiss();
    shownToasts.clear();
    toastIdRef.current = null;
  }, []);

  return {
    toast,
    toastSuccess,
    toastError,
    dismissToast,
    clearAllToasts,
  };
};

export default useToast;
