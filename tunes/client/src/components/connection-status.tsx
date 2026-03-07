import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConnectionStatusProps {
  isConnected: boolean;
  error?: string | null;
  className?: string;
}

export function ConnectionStatus({ isConnected, error, className }: ConnectionStatusProps) {
  return (
    <div className={className}>
      <Badge 
        variant={isConnected ? "default" : "destructive"}
        className="flex items-center gap-2"
      >
        {isConnected ? (
          <>
            <Wifi className="h-3 w-3" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Disconnected</span>
          </>
        )}
      </Badge>
      {error && (
        <p className="text-xs text-destructive mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
