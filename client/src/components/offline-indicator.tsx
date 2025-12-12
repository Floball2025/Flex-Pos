import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi, Clock } from "lucide-react";
import { offlineQueue } from "@/lib/offline-queue";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      setQueueSize(offlineQueue.getQueueSize());
    };

    const queueInterval = setInterval(() => {
      setQueueSize(offlineQueue.getQueueSize());
    }, 1000);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      clearInterval(queueInterval);
    };
  }, []);

  if (isOnline && queueSize === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <Badge variant="destructive" className="gap-2">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
      )}
      
      {queueSize > 0 && (
        <Badge variant="secondary" className="gap-2">
          <Clock className="h-3 w-3" />
          {queueSize} na fila
        </Badge>
      )}
      
      {isOnline && queueSize > 0 && (
        <Badge variant="default" className="gap-2 animate-pulse">
          <Wifi className="h-3 w-3" />
          Processando...
        </Badge>
      )}
    </div>
  );
}
