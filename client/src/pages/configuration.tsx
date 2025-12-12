import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Configuration, configurationSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Settings, Download, FileText, FileJson, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { transactionLogger } from "@/lib/transaction-logger";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";

export default function ConfigurationPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [logCount, setLogCount] = useState(0);
  const currentUser = getCurrentUser();

  const form = useForm<Configuration>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      host: "",
      aid_pass: "",
      acquirerID: "",
      terminalID: "",
      transactionEndpoint: "/action",
      tokenEndpoint: "/createtoken",
      useFixedAmount: false,
    },
  });

  // Fetch configuration from server
  const { data: serverConfig, isLoading } = useQuery<Configuration>({
    queryKey: ['/api/config', currentUser],
    enabled: !!currentUser,
    retry: false,
  });

  // Mutation to save configuration
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Configuration) => {
      const response = await apiRequest("POST", `/api/config/${currentUser}`, data);
      return await response.json();
    },
    onSuccess: (savedConfig) => {
      // Also save to localStorage as backup
      localStorage.setItem("loyalty_config", JSON.stringify(savedConfig));
      queryClient.invalidateQueries({ queryKey: ['/api/config', currentUser] });
      toast({
        title: "Configuração Salva",
        description: "As configurações foram sincronizadas em todos os dispositivos.",
      });
      setTimeout(() => setLocation("/"), 500);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao Salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Update log count
    const logs = transactionLogger.getLogs();
    setLogCount(logs.length);

    // Load configuration priority: server > localStorage
    if (serverConfig) {
      form.reset(serverConfig);
      localStorage.setItem("loyalty_config", JSON.stringify(serverConfig));
    } else if (!isLoading) {
      // Try localStorage if server config doesn't exist
      const savedConfig = localStorage.getItem("loyalty_config");
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          form.reset(config);
          // Auto-migrate to server
          if (currentUser) {
            saveConfigMutation.mutate(config);
          }
        } catch (error) {
          console.error("Failed to load configuration", error);
        }
      }
    }
  }, [serverConfig, isLoading, currentUser]);

  const onSubmit = (data: Configuration) => {
    saveConfigMutation.mutate(data);
  };

  const downloadLogs = (format: 'json' | 'txt') => {
    try {
      const logs = format === 'json' 
        ? transactionLogger.exportLogs() 
        : transactionLogger.exportLogsAsText();
      
      const blob = new Blob([logs], { 
        type: format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cafe-pontua-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Logs Exportados",
        description: `Arquivo baixado com sucesso em formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível exportar os logs.",
        variant: "destructive",
      });
    }
  };

  const clearLogs = () => {
    try {
      transactionLogger.clearLogs();
      setLogCount(0);
      toast({
        title: "Logs Limpos",
        description: "Todos os logs foram removidos com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível limpar os logs.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Configurações</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configurações do Terminal</CardTitle>
            <CardDescription>
              Configure as credenciais necessárias para processar transações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://api.example.com"
                          {...field}
                          data-testid="input-host"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aid_pass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acquirerID"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acquirer ID <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Digite o Acquirer ID"
                          {...field}
                          data-testid="input-acquirer-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terminalID"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminal ID <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Digite o Terminal ID"
                          {...field}
                          data-testid="input-terminal-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transactionEndpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint de Transações <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="/action"
                          {...field}
                          data-testid="input-transaction-endpoint"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tokenEndpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint de Token <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="/createtoken"
                          {...field}
                          data-testid="input-token-endpoint"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="useFixedAmount"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Modo: Pontuação
                        </FormLabel>
                        <FormDescription>
                          Ativar para usar valor fixo de R$ 1,00 em todas as transações
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-fixed-amount"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-14"
                  data-testid="button-save-config"
                >
                  <Save className="h-5 w-5 mr-2" />
                  Salvar Configurações
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Logs Export Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Logs de Transações</CardTitle>
            <CardDescription>
              Exporte logs detalhados de todas as transações processadas para análise de erros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Total de Logs Armazenados</p>
                <p className="text-2xl font-bold text-primary">{logCount}</p>
              </div>
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => downloadLogs('json')}
                disabled={logCount === 0}
                data-testid="button-export-json"
              >
                <FileJson className="h-5 w-5 mr-2" />
                Exportar JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadLogs('txt')}
                disabled={logCount === 0}
                data-testid="button-export-txt"
              >
                <FileText className="h-5 w-5 mr-2" />
                Exportar TXT
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={clearLogs}
              disabled={logCount === 0}
              className="w-full"
              data-testid="button-clear-logs"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Limpar Todos os Logs
            </Button>

            <div className="text-xs text-muted-foreground space-y-1 mt-4 p-3 bg-muted/50 rounded">
              <p className="font-semibold">ℹ️ Informações dos Logs:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Capturam todas as requisições e respostas da API</li>
                <li>Incluem timestamps, payloads, headers e erros</li>
                <li>Armazenam até 100 logs mais recentes</li>
                <li>Úteis para debug e análise de problemas</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
