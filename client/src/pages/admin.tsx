import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Terminal, Users, ArrowLeft, Settings } from "lucide-react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: string;
  name: string;
  businessType: string;
  createdAt: string;
}

interface CompanyDetails {
  terminals: Array<{ id: string; terminalId: string; name: string; isActive: boolean }>;
  users: Array<{ id: string; username: string; fullName: string; role: string }>;
  config?: { 
    host: string; 
    aidPass: string; 
    acquirerId: string;
    transactionEndpoint: string;
    tokenEndpoint: string;
    useFixedAmount: boolean;
  };
}

function CompanyCard({ 
  company, 
  onEdit, 
  onDelete,
  onEditTerminal,
  onDeleteTerminal,
  onDeleteUser,
}: { 
  company: Company; 
  onEdit: (company: Company) => void;
  onDelete: (companyId: string) => void;
  onEditTerminal: (terminal: any) => void;
  onDeleteTerminal: (terminalId: string) => void;
  onDeleteUser: (userId: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { data: details, isLoading } = useQuery<CompanyDetails>({
    queryKey: ["/api/admin/companies", company.id],
    enabled: showDetails,
  });

  return (
    <div className="border rounded-md">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div>
          <h3 className="font-medium">{company.name}</h3>
          <p className="text-sm text-muted-foreground">{company.businessType}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(company);
            }}
            data-testid={`button-edit-company-${company.id}`}
          >
            Editar
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Tem certeza que deseja deletar "${company.name}"? Todos os terminais, usuários e configurações serão removidos.`)) {
                onDelete(company.id);
              }
            }}
            data-testid={`button-delete-company-${company.id}`}
          >
            Deletar
          </Button>
          <Button variant="ghost" size="sm">
            {showDetails ? "Ocultar" : "Ver Detalhes"}
          </Button>
        </div>
      </div>
      
      {showDetails && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {/* Terminals */}
              <div>
                <h4 className="font-medium text-sm mb-2">Terminais ({details?.terminals.length || 0})</h4>
                {details?.terminals && details.terminals.length > 0 ? (
                  <div className="space-y-2">
                    {details.terminals.map((terminal) => (
                      <div key={terminal.id} className="text-sm p-2 bg-muted rounded flex items-center justify-between">
                        <div>
                          <span className="font-medium">{terminal.terminalId}</span> - {terminal.name}
                          {!terminal.isActive && <span className="text-destructive ml-2">(Inativo)</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTerminal(terminal);
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Deletar terminal "${terminal.name}"?`)) {
                                onDeleteTerminal(terminal.id);
                              }
                            }}
                          >
                            Deletar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum terminal cadastrado</p>
                )}
              </div>

              {/* Users */}
              <div>
                <h4 className="font-medium text-sm mb-2">Usuários ({details?.users.length || 0})</h4>
                {details?.users && details.users.length > 0 ? (
                  <div className="space-y-2">
                    {details.users.map((user) => (
                      <div key={user.id} className="text-sm p-2 bg-muted rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                          <div className="text-muted-foreground">{user.username} • {user.role === 'admin' ? 'Admin' : 'Usuário'}</div>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Deletar usuário "${user.fullName}"?`)) {
                              onDeleteUser(user.id);
                            }
                          }}
                        >
                          Deletar
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado</p>
                )}
              </div>

              {/* API Config */}
              <div>
                <h4 className="font-medium text-sm mb-2">Configuração de API</h4>
                {details?.config ? (
                  <div className="text-sm p-2 bg-muted rounded space-y-1">
                    <div><span className="font-medium">Host:</span> {details.config.host}</div>
                    <div><span className="font-medium">AID Pass:</span> ••••••••</div>
                    <div><span className="font-medium">Acquirer ID:</span> {details.config.acquirerId}</div>
                    <div><span className="font-medium">Transaction Endpoint:</span> {details.config.transactionEndpoint}</div>
                    <div><span className="font-medium">Token Endpoint:</span> {details.config.tokenEndpoint}</div>
                    <div><span className="font-medium">Valor Fixo (R$ 0,01):</span> {details.config.useFixedAmount ? 'Sim' : 'Não'}</div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">API não configurada</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showNewTerminal, setShowNewTerminal] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showEditTerminal, setShowEditTerminal] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingTerminal, setEditingTerminal] = useState<any>(null);
  const [logoBase64, setLogoBase64] = useState("");

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [terminalActive, setTerminalActive] = useState(true);
  const [userUsername, setUserUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "user">("user");
  
  // Config states
  const [configHost, setConfigHost] = useState("https://l2flow.com.br");
  const [configAidPass, setConfigAidPass] = useState("");
  const [configAcquirerId, setConfigAcquirerId] = useState("");
  const [configTransactionEndpoint, setConfigTransactionEndpoint] = useState("/transaction");
  const [configTokenEndpoint, setConfigTokenEndpoint] = useState("/token");
  const [configUseFixedAmount, setConfigUseFixedAmount] = useState(false);

  // Fetch companies
  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; businessType: string }) => {
      const res = await apiRequest("POST", "/api/admin/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Empresa Criada",
        description: "A empresa foi criada com sucesso.",
      });
      setShowNewCompany(false);
      setCompanyName("");
      setBusinessType("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Criar Empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; businessType: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/companies/${data.id}`, {
        name: data.name,
        businessType: data.businessType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Empresa Atualizada",
        description: "A empresa foi atualizada com sucesso.",
      });
      setShowEditCompany(false);
      setEditingCompany(null);
      setCompanyName("");
      setBusinessType("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Atualizar Empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create terminal mutation
  const createTerminalMutation = useMutation({
    mutationFn: async (data: { companyId: string; terminalId: string; name: string }) => {
      const res = await apiRequest("POST", `/api/admin/companies/${data.companyId}/terminals`, {
        terminalId: data.terminalId,
        name: data.name,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Terminal Criado",
        description: "O terminal foi criado com sucesso.",
      });
      setShowNewTerminal(false);
      setTerminalId("");
      setTerminalName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Criar Terminal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { 
      companyId: string; 
      username: string; 
      password: string; 
      fullName: string;
      role: "admin" | "user";
    }) => {
      const res = await apiRequest("POST", `/api/admin/companies/${data.companyId}/users`, {
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário Criado",
        description: "O usuário foi criado com sucesso.",
      });
      setShowNewUser(false);
      setUserUsername("");
      setUserPassword("");
      setUserFullName("");
      setUserRole("user");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Criar Usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/companies/${companyId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Empresa Deletada",
        description: "A empresa foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Deletar Empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update terminal mutation
  const updateTerminalMutation = useMutation({
    mutationFn: async (data: { id: string; terminalId: string; name: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/terminals/${data.id}`, {
        terminalId: data.terminalId,
        name: data.name,
        isActive: data.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Terminal Atualizado",
        description: "O terminal foi atualizado com sucesso.",
      });
      setShowEditTerminal(false);
      setEditingTerminal(null);
      setTerminalId("");
      setTerminalName("");
      setTerminalActive(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Atualizar Terminal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete terminal mutation
  const deleteTerminalMutation = useMutation({
    mutationFn: async (terminalId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/terminals/${terminalId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Terminal Deletado",
        description: "O terminal foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Deletar Terminal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Usuário Deletado",
        description: "O usuário foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Deletar Usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set company config mutation
  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (data: { companyId: string; logoUrl: string }) => {
      const res = await apiRequest("POST", `/api/admin/companies/${data.companyId}/branding`, {
        logoUrl: data.logoUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({
        title: "Logo Atualizado",
        description: "O logo foi salvo com sucesso.",
      });
      setShowLogoDialog(false);
      setLogoBase64("");
      setSelectedCompanyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Salvar Logo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setConfigMutation = useMutation({
    mutationFn: async (data: {
      companyId: string;
      host: string;
      aidPass: string;
      acquirerId: string;
      transactionEndpoint: string;
      tokenEndpoint: string;
      useFixedAmount: boolean;
    }) => {
      const res = await apiRequest("POST", `/api/admin/companies/${data.companyId}/config`, {
        host: data.host,
        aidPass: data.aidPass,
        acquirerId: data.acquirerId,
        transactionEndpoint: data.transactionEndpoint,
        tokenEndpoint: data.tokenEndpoint,
        useFixedAmount: data.useFixedAmount,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração Salva",
        description: "As configurações de API foram salvas com sucesso.",
      });
      setShowConfigDialog(false);
      resetConfigForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Salvar Configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetConfigForm = () => {
    setConfigHost("https://l2flow.com.br");
    setConfigAidPass("");
    setConfigAcquirerId("");
    setConfigTransactionEndpoint("/transaction");
    setConfigTokenEndpoint("/token");
    setConfigUseFixedAmount(false);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate({ name: companyName, businessType });
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyName(company.name);
    setBusinessType(company.businessType);
    setShowEditCompany(true);
  };

  const handleUpdateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    updateCompanyMutation.mutate({
      id: editingCompany.id,
      name: companyName,
      businessType,
    });
  };

  const handleCreateTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa primeiro.",
        variant: "destructive",
      });
      return;
    }
    createTerminalMutation.mutate({
      companyId: selectedCompanyId,
      terminalId,
      name: terminalName,
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa primeiro.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate({
      companyId: selectedCompanyId,
      username: userUsername,
      password: userPassword,
      fullName: userFullName,
      role: userRole,
    });
  };

  const handleSetConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa primeiro.",
        variant: "destructive",
      });
      return;
    }
    setConfigMutation.mutate({
      companyId: selectedCompanyId,
      host: configHost,
      aidPass: configAidPass,
      acquirerId: configAcquirerId,
      transactionEndpoint: configTransactionEndpoint,
      tokenEndpoint: configTokenEndpoint,
      useFixedAmount: configUseFixedAmount,
    });
  };

  // Query to load company config when needed
  const { data: selectedCompanyDetails } = useQuery<CompanyDetails>({
    queryKey: ["/api/admin/companies", selectedCompanyId],
    enabled: !!selectedCompanyId && showConfigDialog,
  });

  // Update form when company details are loaded
  useEffect(() => {
    if (selectedCompanyDetails?.config && showConfigDialog) {
      setConfigHost(selectedCompanyDetails.config.host);
      setConfigAidPass(selectedCompanyDetails.config.aidPass);
      setConfigAcquirerId(selectedCompanyDetails.config.acquirerId);
      setConfigTransactionEndpoint(selectedCompanyDetails.config.transactionEndpoint);
      setConfigTokenEndpoint(selectedCompanyDetails.config.tokenEndpoint);
      setConfigUseFixedAmount(selectedCompanyDetails.config.useFixedAmount);
    } else if (selectedCompanyId && showConfigDialog && !selectedCompanyDetails?.config) {
      // Reset to defaults if no config exists
      resetConfigForm();
    }
  }, [selectedCompanyDetails, selectedCompanyId, showConfigDialog]);

  const handleEditTerminal = (terminal: any) => {
    setEditingTerminal(terminal);
    setTerminalId(terminal.terminalId);
    setTerminalName(terminal.name);
    setTerminalActive(terminal.isActive);
    setShowEditTerminal(true);
  };

  const handleUpdateTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerminal) return;
    updateTerminalMutation.mutate({
      id: editingTerminal.id,
      terminalId,
      name: terminalName,
      isActive: terminalActive,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Administração</h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="hover-elevate cursor-pointer" onClick={() => setShowNewCompany(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Nova Empresa
              </CardTitle>
              <CardDescription>Cadastrar uma nova empresa no sistema</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setShowNewTerminal(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Novo Terminal
              </CardTitle>
              <CardDescription>Adicionar terminal a uma empresa</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setShowNewUser(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Novo Usuário
              </CardTitle>
              <CardDescription>Criar usuário para uma empresa</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setShowConfigDialog(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurar API
              </CardTitle>
              <CardDescription>Definir credenciais de API da empresa</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setShowLogoDialog(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Carregar Logo
              </CardTitle>
              <CardDescription>Upload de logo da empresa</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Companies List */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>Total: {companies?.length || 0} empresas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {companies?.map((company) => (
                <CompanyCard 
                  key={company.id} 
                  company={company} 
                  onEdit={handleEditCompany}
                  onDelete={(id) => deleteCompanyMutation.mutate(id)}
                  onEditTerminal={handleEditTerminal}
                  onDeleteTerminal={(id) => deleteTerminalMutation.mutate(id)}
                  onDeleteUser={(id) => deleteUserMutation.mutate(id)}
                />
              ))}
              {!companies || companies.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma empresa cadastrada
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Company Dialog */}
      <Dialog open={showNewCompany} onOpenChange={setShowNewCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa no sistema
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCompany}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="Ex: Bem Lindinha Acessórios"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Tipo de Negócio</Label>
                <Input
                  id="businessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  required
                  placeholder="Ex: Acessórios, Restaurante, etc."
                  data-testid="input-business-type"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowNewCompany(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCompanyMutation.isPending} data-testid="button-create-company">
                {createCompanyMutation.isPending ? "Criando..." : "Criar Empresa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditCompany} onOpenChange={setShowEditCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Atualize os dados da empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCompany}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editCompanyName">Nome da Empresa</Label>
                <Input
                  id="editCompanyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="Ex: Bem Lindinha Acessórios"
                  data-testid="input-edit-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBusinessType">Tipo de Negócio</Label>
                <Input
                  id="editBusinessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  required
                  placeholder="Ex: Acessórios, Restaurante, etc."
                  data-testid="input-edit-business-type"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditCompany(false);
                setEditingCompany(null);
                setCompanyName("");
                setBusinessType("");
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateCompanyMutation.isPending} data-testid="button-update-company">
                {updateCompanyMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Terminal Dialog */}
      <Dialog open={showNewTerminal} onOpenChange={setShowNewTerminal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Terminal</DialogTitle>
            <DialogDescription>
              Adicione um terminal a uma empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTerminal}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terminalCompany">Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger data-testid="select-terminal-company">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminalId">ID do Terminal</Label>
                <Input
                  id="terminalId"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  required
                  placeholder="Ex: bemL001"
                  data-testid="input-terminal-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminalName">Nome do Terminal</Label>
                <Input
                  id="terminalName"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  required
                  placeholder="Ex: Loja Centro"
                  data-testid="input-terminal-name"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowNewTerminal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTerminalMutation.isPending} data-testid="button-create-terminal">
                {createTerminalMutation.isPending ? "Criando..." : "Criar Terminal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Terminal Dialog */}
      <Dialog open={showEditTerminal} onOpenChange={setShowEditTerminal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Terminal</DialogTitle>
            <DialogDescription>
              Atualize as informações do terminal
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTerminal}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editTerminalId">ID do Terminal</Label>
                <Input
                  id="editTerminalId"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  required
                  placeholder="Ex: bemL001"
                  data-testid="input-edit-terminal-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editTerminalName">Nome do Terminal</Label>
                <Input
                  id="editTerminalName"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  required
                  placeholder="Ex: Loja Centro"
                  data-testid="input-edit-terminal-name"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editTerminalActive"
                  checked={terminalActive}
                  onCheckedChange={(checked) => setTerminalActive(!!checked)}
                  data-testid="checkbox-edit-terminal-active"
                />
                <Label htmlFor="editTerminalActive" className="text-sm font-normal cursor-pointer">
                  Terminal ativo
                </Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditTerminal(false);
                setEditingTerminal(null);
                setTerminalId("");
                setTerminalName("");
                setTerminalActive(true);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateTerminalMutation.isPending} data-testid="button-update-terminal">
                {updateTerminalMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Crie um usuário para uma empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userCompany">Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger data-testid="select-user-company">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail">Usuário</Label>
                <Input
                  id="userEmail"
                  type="text"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  required
                  placeholder="lind888"
                  data-testid="input-user-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPassword">Senha</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  data-testid="input-user-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userFullName">Nome Completo</Label>
                <Input
                  id="userFullName"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  required
                  placeholder="Nome completo do usuário"
                  data-testid="input-user-fullname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userRole">Tipo de Acesso</Label>
                <Select value={userRole} onValueChange={(val) => setUserRole(val as "admin" | "user")}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário Normal</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowNewUser(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-create-user">
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Config API Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar API da Empresa</DialogTitle>
            <DialogDescription>
              Configure as credenciais e endpoints da API L2Flow
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetConfig}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="configCompany">Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger data-testid="select-config-company">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="configHost">Host da API</Label>
                  <Input
                    id="configHost"
                    value={configHost}
                    onChange={(e) => setConfigHost(e.target.value)}
                    required
                    placeholder="https://l2flow.com.br"
                    data-testid="input-config-host"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="configAidPass">AID Pass</Label>
                  <Input
                    id="configAidPass"
                    value={configAidPass}
                    onChange={(e) => setConfigAidPass(e.target.value)}
                    required
                    placeholder="Credencial AID"
                    data-testid="input-config-aidpass"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="configAcquirerId">Acquirer ID</Label>
                  <Input
                    id="configAcquirerId"
                    value={configAcquirerId}
                    onChange={(e) => setConfigAcquirerId(e.target.value)}
                    required
                    placeholder="ID do adquirente"
                    data-testid="input-config-acquirer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="configTransactionEndpoint">Endpoint de Transação</Label>
                  <Input
                    id="configTransactionEndpoint"
                    value={configTransactionEndpoint}
                    onChange={(e) => setConfigTransactionEndpoint(e.target.value)}
                    required
                    placeholder="/transaction"
                    data-testid="input-config-transaction-endpoint"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="configTokenEndpoint">Endpoint de Token</Label>
                  <Input
                    id="configTokenEndpoint"
                    value={configTokenEndpoint}
                    onChange={(e) => setConfigTokenEndpoint(e.target.value)}
                    required
                    placeholder="/token"
                    data-testid="input-config-token-endpoint"
                  />
                </div>

                <div className="flex items-center space-x-2 col-span-2">
                  <Checkbox
                    id="configUseFixedAmount"
                    checked={configUseFixedAmount}
                    onCheckedChange={(checked) => setConfigUseFixedAmount(!!checked)}
                    data-testid="checkbox-config-fixed-amount"
                  />
                  <Label htmlFor="configUseFixedAmount" className="text-sm font-normal cursor-pointer">
                    Usar valor fixo de R$ 0,01 para transações
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => { setShowConfigDialog(false); resetConfigForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={setConfigMutation.isPending} data-testid="button-save-config">
                {setConfigMutation.isPending ? "Salvando..." : "Salvar Configuração"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Logo Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carregar Logo da Empresa</DialogTitle>
            <DialogDescription>
              Selecione uma empresa e faça upload do logo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!selectedCompanyId || !logoBase64) {
              toast({
                title: "Erro",
                description: "Selecione uma empresa e uma imagem.",
                variant: "destructive",
              });
              return;
            }
            uploadLogoMutation.mutate({ companyId: selectedCompanyId, logoUrl: logoBase64 });
          }}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoCompany">Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger data-testid="select-logo-company">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="logoFile">Logo (PNG, JPG)</Label>
                <Input
                  id="logoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setLogoBase64(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  data-testid="input-logo-file"
                />
              </div>

              {logoBase64 && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded p-4 flex items-center justify-center bg-muted">
                    <img src={logoBase64} alt="Logo preview" className="h-20 w-auto object-contain" />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => { setShowLogoDialog(false); setLogoBase64(""); setSelectedCompanyId(""); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadLogoMutation.isPending} data-testid="button-upload-logo">
                {uploadLogoMutation.isPending ? "Salvando..." : "Salvar Logo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
