import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import { TransactionHistory } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Period = "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("daily");
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("transaction_history");
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load transactions", error);
      }
    }
  }, []);

  const analytics = useMemo(() => {
    const now = new Date();
    const periodStart = new Date();
    
    if (period === "daily") {
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === "weekly") {
      periodStart.setDate(now.getDate() - 7);
    } else {
      periodStart.setDate(now.getDate() - 30);
    }

    const periodTransactions = transactions.filter(t => 
      new Date(t.timestamp) >= periodStart
    );

    const successful = periodTransactions.filter(t => t.resultCode === "00");
    const failed = periodTransactions.filter(t => t.resultCode !== "00");

    const totalPoints = successful.reduce((sum, t) => 
      sum + parseInt(t.bonus || "0"), 0
    );

    const uniqueClients = new Set(successful.map(t => t.clientID)).size;

    // Group by date for chart
    const dateGroups: Record<string, { success: number; failed: number }> = {};
    periodTransactions.forEach(t => {
      const date = new Date(t.timestamp).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      if (!dateGroups[date]) {
        dateGroups[date] = { success: 0, failed: 0 };
      }
      if (t.resultCode === "00") {
        dateGroups[date].success++;
      } else {
        dateGroups[date].failed++;
      }
    });

    const chartData = Object.entries(dateGroups).map(([date, counts]) => ({
      date,
      ...counts,
    })).slice(-10); // Last 10 data points

    return {
      total: periodTransactions.length,
      successful: successful.length,
      failed: failed.length,
      totalPoints,
      uniqueClients,
      chartData,
      successRate: periodTransactions.length > 0 
        ? ((successful.length / periodTransactions.length) * 100).toFixed(1)
        : "0",
    };
  }, [transactions, period]);

  const pieData = [
    { name: "Aprovadas", value: analytics.successful, color: "#22c55e" },
    { name: "Negadas", value: analytics.failed, color: "#ef4444" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Análise de Transações</h1>
              <p className="text-sm text-muted-foreground">Estatísticas e métricas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="daily" data-testid="tab-daily">Hoje</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly">7 Dias</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">30 Dias</TabsTrigger>
          </TabsList>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Transações</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total">{analytics.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.successRate}% aprovadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pontos Distribuídos</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-points">{analytics.totalPoints}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  De {analytics.successful} transações
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-clients">{analytics.uniqueClients}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clientes atendidos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-success-rate">{analytics.successRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.failed} falhas
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Transações por Data</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="success" fill="#22c55e" name="Aprovadas" />
                      <Bar dataKey="failed" fill="#ef4444" name="Negadas" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
