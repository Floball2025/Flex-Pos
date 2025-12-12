import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

export function QrScanner({ onScan, isActive, onActiveChange }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isActive) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        () => {
          // Ignore scan errors
        }
      );
      setError("");
    } catch (err) {
      setError("Não foi possível acessar a câmera");
      onActiveChange(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <div id="qr-reader" className={isActive ? "block" : "hidden"} />
        
        {isActive && (
          <div className="absolute inset-4 pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-primary" />
            <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-primary" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-primary" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-primary" />
          </div>
        )}
        
        {!isActive && (
          <div className="aspect-video flex items-center justify-center bg-muted">
            <div className="text-center space-y-4 p-8">
              <CameraOff className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Scanner de QR Code desativado
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border-t border-destructive/20">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}
      </div>

      <div className="p-4 flex justify-center gap-4 border-t">
        <Button
          variant={isActive ? "destructive" : "default"}
          onClick={() => onActiveChange(!isActive)}
          data-testid="button-toggle-scanner"
        >
          {isActive ? (
            <>
              <CameraOff className="h-5 w-5 mr-2" />
              Parar Scanner
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              Iniciar Scanner
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
