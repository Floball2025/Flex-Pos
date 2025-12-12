import { CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionResponse } from "@shared/schema";

interface TransactionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    data?: TransactionResponse;
    error?: string;
  };
}

export function TransactionResultModal({
  isOpen,
  onClose,
  result,
}: TransactionResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-sm w-full p-8 relative animate-in fade-in zoom-in duration-200">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={onClose}
          data-testid="button-close-result"
        >
          <X className="h-5 w-5" />
        </Button>

        {result.success && result.data ? (
          <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" data-testid="icon-success" />
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Transação Concluída!</h2>
              <p className="text-sm text-muted-foreground">
                Pontos acumulados com sucesso
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">RRN:</span>
                <span className="text-base font-medium" data-testid="text-rrn">
                  {result.data.rrn}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pontos Ganhos:</span>
                <span className="text-2xl font-bold text-primary" data-testid="text-bonus">
                  {(parseInt(result.data.additionalData.bonus) / 100).toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Saldo Total:</span>
                <span className="text-xl font-bold" data-testid="text-balance">
                  {(parseInt(result.data.additionalData.balance) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={onClose}
              className="w-full h-12"
              data-testid="button-new-transaction"
            >
              Nova Transação
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 mx-auto text-destructive" data-testid="icon-error" />
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Erro na Transação</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-error-message">
                {result.error || "Ocorreu um erro ao processar a transação"}
              </p>
            </div>

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full h-12"
              data-testid="button-try-again"
            >
              Tentar Novamente
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
