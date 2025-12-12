import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionHistory } from "@shared/schema";
import { CheckCircle, XCircle, Clock, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TransactionHistoryProps {
  transactions: TransactionHistory[];
}

export function TransactionHistoryList({ transactions }: TransactionHistoryProps) {
  const { toast } = useToast();

  const handleExportCSV = async () => {
    try {
      const response = await apiRequest("POST", "/api/transactions/export/csv", { transactions });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transacoes_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Exportado com Sucesso",
        description: "Arquivo CSV baixado",
      });
    } catch (error) {
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível exportar o arquivo CSV",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await apiRequest("POST", "/api/transactions/export/pdf", { transactions });
      const html = await response.text();
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
        setTimeout(() => {
          newWindow.print();
        }, 500);
      }
      
      toast({
        title: "PDF Gerado",
        description: "Relatório aberto para impressão",
      });
    } catch (error) {
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF",
        variant: "destructive",
      });
    }
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma transação realizada ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-xl">Histórico de Transações</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              data-testid="button-export-pdf"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {transactions.slice(0, 5).map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
            data-testid={`transaction-item-${transaction.id}`}
          >
            <div className="flex items-center gap-3 flex-1">
              {transaction.resultCode === "00" ? (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              )}
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  Cliente: {transaction.clientID}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(transaction.timestamp).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {transaction.resultCode === "00" && transaction.bonus && (
                <Badge variant="secondary" className="whitespace-nowrap">
                  +{transaction.bonus} pts
                </Badge>
              )}
              
              {transaction.resultCode === "00" && transaction.balance && (
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Saldo: {transaction.balance}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
