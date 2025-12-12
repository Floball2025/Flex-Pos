import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Camera, Send, Trash2, Settings, LogOut, CheckCircle2 } from "lucide-react";
import { logout, getCurrentUser } from "@/lib/auth";
import { sha1 } from "@/lib/sha1";
import { transactionLogger } from "@/lib/transaction-logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { QrScanner } from "@/components/qr-scanner";
import { TransactionResultModal } from "@/components/transaction-result-modal";
import { TransactionHistory, TransactionResponse, Configuration } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { offlineQueue } from "@/lib/offline-queue";
import bemLindinha from "@assets/logo-bem-lindinha.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scannerActive, setScannerActive] = useState(false);
  const [qrCodeScanned, setQrCodeScanned] = useState("");
  const [clientId, setClientId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeConfig, setActiveConfig] = useState<Configuration | null>(null);
  const currentUser = getCurrentUser();
  const [showResult, setShowResult] = useState(false);
  const [transactionResult, setTransactionResult] = useState<{
    success: boolean;
    data?: TransactionResponse;
    error?: string;
  }>({ success: false });
  const [clientBalance, setClientBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showCashbackModal, setShowCashbackModal] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("");
  const [showConfigPasswordDialog, setShowConfigPasswordDialog] = useState(false);
  const [configPassword, setConfigPassword] = useState("");

  // Busca configuração do servidor
  const { data: serverConfig, isLoading: isLoadingConfig } = useQuery<Configuration>({
    queryKey: ['/api/config', currentUser?.id],
    enabled: !!currentUser,
    retry: false,
  });

  // Busca branding da empresa (nome e logo)
  const { data: brandingData } = useQuery<{
    companyName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  }>({
    queryKey: ['/api/branding'],
    enabled: !!currentUser,
    retry: false,
  });

  useEffect(() => {
    // Usa APENAS config do servidor (sem migração automática do localStorage)
    if (serverConfig) {
      setIsConfigured(true);
      setActiveConfig(serverConfig);
      // Sincroniza para localStorage apenas como backup/cache
      localStorage.setItem("loyalty_config", JSON.stringify(serverConfig));
    } else if (!isLoadingConfig) {
      // Se não há config no servidor, usuário deve configurar manualmente
      setIsConfigured(false);
      setActiveConfig(null);
    }
  }, [serverConfig, isLoadingConfig]);

  // Efeito para consultar saldo quando ID ou telefone do cliente muda
  useEffect(() => {
    const queryBalanceOnIdentifier = async () => {
      if (!isConfigured || !activeConfig) return;
      
      // Limpa saldo quando campos são apagados
      if (!clientId && !phoneNumber && !qrCodeScanned) {
        setClientBalance(null);
        return;
      }
      
      let clientCode = "";
      
      if (clientId && /^\d{6,7}$/.test(clientId)) {
        // ID do cliente é válido (6-7 dígitos)
        const hash = await sha1(clientId);
        clientCode = `0e${hash}`;
      } else if (phoneNumber && phoneNumber.length >= 9) {
        // Telefone tem pelo menos 9 dígitos
        let processedPhone = phoneNumber;
        const phoneLength = phoneNumber.length;
        
        if (phoneLength === 9) {
          processedPhone = `5561${phoneNumber}`;
        } else if (phoneLength === 11) {
          processedPhone = `55${phoneNumber}`;
        } else if (phoneLength === 13) {
          processedPhone = phoneNumber; // Usa como está
        } else {
          return; // Tamanho de telefone inválido
        }
        
        const hash = await sha1(processedPhone);
        clientCode = `0f${hash}`;
      }
      
      if (clientCode) {
        queryBalance(clientCode);
      }
    };
    
    queryBalanceOnIdentifier();
  }, [clientId, phoneNumber, isConfigured, activeConfig]);

  const processTransactionMutation = useMutation<
    TransactionResponse,
    Error,
    { clientID: string; config: any; products?: any[]; transactionAmount?: string }
  >({
    mutationFn: async (data: { clientID: string; config: any; products?: any[]; transactionAmount?: string }) => {
      // Sanitiza config antes de logar (remove sensitive data)
      const sanitizedConfig = {
        ...data.config,
        aid_pass: '***REDACTED***'
      };

      // Log transaction start
      transactionLogger.log({
        step: 'Transaction Started',
        type: 'info',
        payload: {
          clientID: data.clientID,
          transactionAmount: data.transactionAmount,
          config: {
            host: sanitizedConfig.host,
            terminalID: sanitizedConfig.terminalID,
            acquirerID: sanitizedConfig.acquirerID,
            aid_pass: '***REDACTED***'
          }
        }
      });

      // Carrega produtos do localStorage
      const productsString = localStorage.getItem("loyalty_products");
      let products = [];
      
      /**
       * CONVERSÃO CRÍTICA: Reais → Centavos (API L2Flow exige valores inteiros)
       * 
       * POR QUE CENTAVOS?
       * - API L2Flow só aceita valores inteiros em centavos
       * - Evita erros de precisão com ponto flutuante (0.1 + 0.2 ≠ 0.3 em JS)
       * - Padrão internacional para APIs financeiras
       * 
       * DETALHE CRÍTICO: .replace(',', '.')
       * Por que precisamos disso?
       * - Alguns navegadores/locales brasileiros retornam números com vírgula: "15,50"
       * - parseFloat("15,50") = 15 (ERRADO! Ignora o ",50")
       * - parseFloat("15.50") = 15.5 (CORRETO)
       * 
       * BUG JÁ ENCONTRADO EM PRODUÇÃO:
       * Entrada do usuário: "15,50" (vírgula decimal)
       * Sem .replace(): parseFloat("15,50") = 15 → 15 * 100 = 1500 (R$ 15,00 ❌)
       * Com .replace(): parseFloat("15.50") = 15.5 → 15.5 * 100 = 1550 (R$ 15,50 ✅)
       * 
       * CÁLCULO PASSO A PASSO:
       * 1. Normaliza vírgula → ponto: "15,50" → "15.50"
       * 2. Converte string → número: parseFloat("15.50") = 15.5
       * 3. Multiplica por 100: 15.5 * 100 = 1550
       * 4. Arredonda (evita 15.505 → 1550.5): Math.round(1550) = 1550
       * 5. Converte para string: "1550"
       * 
       * RESULTADO FINAL: API recebe "1550" centavos = R$ 15,50
       * 
       * ⚠️ NUNCA remova .replace(',', '.') - causará bugs em navegadores brasileiros!
       */
      const amountInCentavos = data.transactionAmount 
        ? Math.round(parseFloat(data.transactionAmount.replace(',', '.')) * 100).toString()
        : "100"; // default 1 real = 100 centavos
      
      if (productsString) {
        try {
          const savedProducts = JSON.parse(productsString);
          
          products = savedProducts.map((p: any) => ({
            name: p.name,
            productId: p.productId,
            pCost: amountInCentavos,  // Usa valor da transação em centavos
            price: amountInCentavos,  // Usa valor da transação em centavos
            quantity: "1000",         // Sempre 1000
            markupDiscount: "0",
            tax: p.tax || "20",
            barcode: p.barcode || p.productId,
            group: p.group || "4b",
            flag: "",
          }));
        } catch (error) {
          console.error("Failed to load products", error);
        }
      }
      
      // Se não há produtos no localStorage, usa padrão
      if (products.length === 0) {
        products = [{
          name: "Bem Lindinha",
          productId: "1000100",
          pCost: amountInCentavos,
          price: amountInCentavos,
          quantity: "1000",
          markupDiscount: "0",
          tax: "20",
          barcode: "1000100",
          group: "4b",
          flag: "",
        }];
      }

      const requestPayload = {
        ...data,
        products: products.length > 0 ? products : undefined,
        transactionAmount: data.transactionAmount,
      };

      // Loga payload completo sendo enviado (com detalhes completos de produtos)
      const logPayload = {
        clientID: data.clientID,
        transactionAmount: data.transactionAmount,
        products: products, // Sempre inclui produtos (array pode estar vazio ou ter itens)
        config: {
          host: data.config.host,
          terminalID: data.config.terminalID,
          acquirerID: data.config.acquirerID,
          aid_pass: '***REDACTED***'
        }
      };

      console.log("\n========================================");
      console.log("📤 JSON ENVIADO PELO APP AO BACKEND:");
      console.log("========================================");
      console.log(JSON.stringify(logPayload, null, 2));
      console.log("========================================\n");

      // Loga requisição da API with full payload (only redact password)
      transactionLogger.log({
        step: 'API Request',
        type: 'request',
        url: '/api/transaction',
        method: 'POST',
        payload: logPayload
      });

      try {
        const response = await apiRequest("POST", "/api/transaction", requestPayload);
        const responseData = await response.json() as TransactionResponse;
        
        // Loga resposta completa recebida
        console.log("\n========================================");
        console.log("📨 RESPOSTA RECEBIDA DO BACKEND:");
        console.log("========================================");
        console.log(JSON.stringify(responseData, null, 2));
        console.log("========================================\n");
        
        // Loga resposta da API
        transactionLogger.log({
          step: 'API Response',
          type: 'response',
          url: '/api/transaction',
          statusCode: response.status,
          response: responseData
        });

        return responseData;
      } catch (error: any) {
        // Loga erro da API
        transactionLogger.log({
          step: 'API Error',
          type: 'error',
          url: '/api/transaction',
          errorMessage: error.message || 'Unknown error'
        });
        throw error;
      }
    },
    onSuccess: async (data: TransactionResponse) => {
      setTransactionResult({ success: true, data });
      setShowResult(true);
      
      // Determina qual identificador do cliente foi usado
      let usedClientId: string;
      if (qrCodeScanned) {
        usedClientId = qrCodeScanned;
      } else if (clientId) {
        const hash = await sha1(clientId);
        usedClientId = `0e${hash}`;
      } else {
        // Processa telefone com lógica de código país/área
        let processedPhone = phoneNumber;
        const phoneLength = phoneNumber.length;
        
        if (phoneLength === 9) {
          processedPhone = `5561${phoneNumber}`;
        } else if (phoneLength === 11) {
          processedPhone = `55${phoneNumber}`;
        }
        
        const hash = await sha1(processedPhone);
        usedClientId = `0f${hash}`;
      }
      
      const newTransaction: TransactionHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        clientID: usedClientId,
        rrn: data.rrn,
        resultCode: data.resultCode,
        bonus: data.additionalData.bonus,
        balance: data.additionalData.balance,
      };
      
      const savedHistory = localStorage.getItem("transaction_history");
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      const updatedHistory = [newTransaction, ...history];
      localStorage.setItem("transaction_history", JSON.stringify(updatedHistory));
      
      setQrCodeScanned("");
      setClientId("");
      setPhoneNumber("");
      setTransactionAmount("");
    },
    onError: async (error: any) => {
      const errorMessage = error.message || "Erro ao processar transação";
      setTransactionResult({ success: false, error: errorMessage });
      setShowResult(true);
      
      // Determina qual identificador do cliente foi usado
      let usedClientId: string;
      if (qrCodeScanned) {
        usedClientId = qrCodeScanned;
      } else if (clientId) {
        const hash = await sha1(clientId);
        usedClientId = `0e${hash}`;
      } else {
        // Processa telefone com lógica de código país/área
        let processedPhone = phoneNumber;
        const phoneLength = phoneNumber.length;
        
        if (phoneLength === 9) {
          processedPhone = `5561${phoneNumber}`;
        } else if (phoneLength === 11) {
          processedPhone = `55${phoneNumber}`;
        }
        
        const hash = await sha1(processedPhone);
        usedClientId = `0f${hash}`;
      }
      
      const failedTransaction: TransactionHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        clientID: usedClientId,
        rrn: "",
        resultCode: "ERROR",
        errorMessage,
      };
      
      const savedHistory = localStorage.getItem("transaction_history");
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      const updatedHistory = [failedTransaction, ...history];
      localStorage.setItem("transaction_history", JSON.stringify(updatedHistory));
      
      setQrCodeScanned("");
      setClientId("");
      setPhoneNumber("");
      setTransactionAmount("");
    },
  });

  // Mutation para resgate de cashback (actionType 8)
  const processCashbackMutation = useMutation<
    TransactionResponse,
    Error,
    { clientID: string; config: any; products?: any[]; transactionAmount?: string }
  >({
    mutationFn: async (data: { clientID: string; config: any; products?: any[]; transactionAmount?: string }) => {
      // Sanitiza config antes de logar
      const sanitizedConfig = {
        ...data.config,
        aid_pass: '***REDACTED***'
      };

      // Loga início do cashback
      transactionLogger.log({
        step: 'Cashback Started',
        type: 'info',
        payload: {
          clientID: data.clientID,
          transactionAmount: data.transactionAmount,
          config: {
            host: sanitizedConfig.host,
            terminalID: sanitizedConfig.terminalID,
            acquirerID: sanitizedConfig.acquirerID,
            aid_pass: '***REDACTED***'
          }
        }
      });

      // Carrega produtos do localStorage
      const productsString = localStorage.getItem("loyalty_products");
      let products = [];
      
      /**
       * CONVERSÃO CRÍTICA: Reais → Centavos (API L2Flow exige valores inteiros)
       * 
       * POR QUE CENTAVOS?
       * - API L2Flow só aceita valores inteiros em centavos
       * - Evita erros de precisão com ponto flutuante (0.1 + 0.2 ≠ 0.3 em JS)
       * - Padrão internacional para APIs financeiras
       * 
       * DETALHE CRÍTICO: .replace(',', '.')
       * Por que precisamos disso?
       * - Alguns navegadores/locales brasileiros retornam números com vírgula: "15,50"
       * - parseFloat("15,50") = 15 (ERRADO! Ignora o ",50")
       * - parseFloat("15.50") = 15.5 (CORRETO)
       * 
       * BUG JÁ ENCONTRADO EM PRODUÇÃO:
       * Entrada do usuário: "15,50" (vírgula decimal)
       * Sem .replace(): parseFloat("15,50") = 15 → 15 * 100 = 1500 (R$ 15,00 ❌)
       * Com .replace(): parseFloat("15.50") = 15.5 → 15.5 * 100 = 1550 (R$ 15,50 ✅)
       * 
       * CÁLCULO PASSO A PASSO:
       * 1. Normaliza vírgula → ponto: "15,50" → "15.50"
       * 2. Converte string → número: parseFloat("15.50") = 15.5
       * 3. Multiplica por 100: 15.5 * 100 = 1550
       * 4. Arredonda (evita 15.505 → 1550.5): Math.round(1550) = 1550
       * 5. Converte para string: "1550"
       * 
       * RESULTADO FINAL: API recebe "1550" centavos = R$ 15,50
       * 
       * ⚠️ NUNCA remova .replace(',', '.') - causará bugs em navegadores brasileiros!
       */
      const amountInCentavos = data.transactionAmount 
        ? Math.round(parseFloat(data.transactionAmount.replace(',', '.')) * 100).toString()
        : "100"; // default 1 real = 100 centavos
      
      if (productsString) {
        try {
          const savedProducts = JSON.parse(productsString);
          
          products = savedProducts.map((p: any) => ({
            name: p.name,
            productId: p.productId,
            pCost: amountInCentavos,  // Usa valor da transação em centavos
            price: amountInCentavos,  // Usa valor da transação em centavos
            quantity: "1000",         // Sempre 1000
            markupDiscount: "0",
            tax: p.tax || "20",
            barcode: p.barcode || p.productId,
            group: p.group || "4b",
            flag: "",
          }));
        } catch (error) {
          console.error("Failed to load products", error);
        }
      }
      
      // Se não há produtos no localStorage, usa padrão
      if (products.length === 0) {
        products = [{
          name: "Bem Lindinha",
          productId: "1000100",
          pCost: amountInCentavos,
          price: amountInCentavos,
          quantity: "1000",
          markupDiscount: "0",
          tax: "20",
          barcode: "1000100",
          group: "4b",
          flag: "",
        }];
      }

      const requestPayload = {
        ...data,
        products: products.length > 0 ? products : undefined,
        transactionAmount: data.transactionAmount,
      };

      // Loga payload completo sendo enviado (com detalhes completos de produtos)
      const logPayload = {
        clientID: data.clientID,
        transactionAmount: data.transactionAmount,
        products: products, // Sempre inclui produtos
        config: {
          host: data.config.host,
          terminalID: data.config.terminalID,
          acquirerID: data.config.acquirerID,
          aid_pass: '***REDACTED***'
        }
      };

      console.log("\n========================================");
      console.log("📤 JSON ENVIADO PELO APP AO BACKEND (CASHBACK):");
      console.log("========================================");
      console.log(JSON.stringify(logPayload, null, 2));
      console.log("========================================\n");

      // Loga requisição da API
      transactionLogger.log({
        step: 'Cashback API Request',
        type: 'request',
        url: '/api/cashback',
        method: 'POST',
        payload: logPayload
      });

      try {
        const response = await apiRequest("POST", "/api/cashback", requestPayload);
        const responseData = await response.json() as TransactionResponse;
        
        // Loga resposta completa recebida
        console.log("\n========================================");
        console.log("📨 RESPOSTA RECEBIDA DO BACKEND (CASHBACK):");
        console.log("========================================");
        console.log(JSON.stringify(responseData, null, 2));
        console.log("========================================\n");
        
        // Loga resposta da API
        transactionLogger.log({
          step: 'Cashback API Response',
          type: 'response',
          url: '/api/cashback',
          statusCode: response.status,
          response: responseData
        });

        return responseData;
      } catch (error: any) {
        // Loga erro da API
        transactionLogger.log({
          step: 'Cashback API Error',
          type: 'error',
          url: '/api/cashback',
          errorMessage: error.message || 'Unknown error'
        });
        throw error;
      }
    },
    onSuccess: async (data: TransactionResponse) => {
      setTransactionResult({ success: true, data });
      setShowResult(true);
      
      // Determina qual identificador do cliente foi usado
      let usedClientId: string;
      if (qrCodeScanned) {
        usedClientId = qrCodeScanned;
      } else if (clientId) {
        const hash = await sha1(clientId);
        usedClientId = `0e${hash}`;
      } else {
        let processedPhone = phoneNumber;
        const phoneLength = phoneNumber.length;
        
        if (phoneLength === 9) {
          processedPhone = `5561${phoneNumber}`;
        } else if (phoneLength === 11) {
          processedPhone = `55${phoneNumber}`;
        }
        
        const hash = await sha1(processedPhone);
        usedClientId = `0f${hash}`;
      }
      
      const newTransaction: TransactionHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        clientID: usedClientId,
        rrn: data.rrn,
        resultCode: data.resultCode,
        bonus: data.additionalData.bonus,
        balance: data.additionalData.balance,
      };
      
      const savedHistory = localStorage.getItem("transaction_history");
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      const updatedHistory = [newTransaction, ...history];
      localStorage.setItem("transaction_history", JSON.stringify(updatedHistory));
      
      setQrCodeScanned("");
      setClientId("");
      setPhoneNumber("");
      setTransactionAmount("");
    },
    onError: async (error: any) => {
      const errorMessage = error.message || "Erro ao processar cashback";
      setTransactionResult({ success: false, error: errorMessage });
      setShowResult(true);
      
      // Determina qual identificador do cliente foi usado
      let usedClientId: string;
      if (qrCodeScanned) {
        usedClientId = qrCodeScanned;
      } else if (clientId) {
        const hash = await sha1(clientId);
        usedClientId = `0e${hash}`;
      } else {
        let processedPhone = phoneNumber;
        const phoneLength = phoneNumber.length;
        
        if (phoneLength === 9) {
          processedPhone = `5561${phoneNumber}`;
        } else if (phoneLength === 11) {
          processedPhone = `55${phoneNumber}`;
        }
        
        const hash = await sha1(processedPhone);
        usedClientId = `0f${hash}`;
      }
      
      const failedTransaction: TransactionHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        clientID: usedClientId,
        rrn: "",
        resultCode: "ERROR",
        errorMessage,
      };
      
      const savedHistory = localStorage.getItem("transaction_history");
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      const updatedHistory = [failedTransaction, ...history];
      localStorage.setItem("transaction_history", JSON.stringify(updatedHistory));
      
      setQrCodeScanned("");
      setClientId("");
      setPhoneNumber("");
      setTransactionAmount("");
    },
  });

  const handleQrScan = (result: string) => {
    setQrCodeScanned(result);
    setClientId("");
    setPhoneNumber("");
    setScannerActive(false);
    toast({
      title: "QR Code Escaneado",
      description: "QR Code capturado com sucesso!",
    });
    
    // Consulta saldo automaticamente
    queryBalance(result);
  };

  const handleClear = () => {
    setQrCodeScanned("");
    setClientId("");
    setPhoneNumber("");
    setTransactionAmount("");
    setScannerActive(false);
    setClientBalance(null);
  };

  // Mutation para consulta de saldo
  const queryBalanceMutation = useMutation<
    TransactionResponse,
    Error,
    { clientID: string; config: any }
  >({
    mutationFn: async (data: { clientID: string; config: any }) => {
      setIsLoadingBalance(true);
      try {
        const response = await apiRequest("POST", "/api/balance", data);
        const responseData = await response.json() as TransactionResponse;
        return responseData;
      } finally {
        setIsLoadingBalance(false);
      }
    },
    onSuccess: (data: TransactionResponse) => {
      if (data.additionalData?.balance) {
        // Converte saldo de centavos para reais
        const balanceInReais = (parseFloat(data.additionalData.balance) / 100).toFixed(2);
        setClientBalance(balanceInReais);
      }
    },
    onError: (error: any) => {
      console.error("Balance query error:", error);
      setClientBalance(null);
      
      // Extrai mensagem de erro detalhada
      let errorMessage = "Não foi possível consultar o saldo do cliente.";
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao Consultar Saldo",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Função para consultar saldo
  const queryBalance = async (clientCode: string) => {
    if (!isConfigured || !activeConfig) return;
    
    const config = {
      host: activeConfig.host,
      terminalID: activeConfig.terminalID,
      acquirerID: activeConfig.acquirerID,
      tokenEndpoint: activeConfig.tokenEndpoint,
      transactionEndpoint: activeConfig.transactionEndpoint,
      aid_pass: activeConfig.aid_pass,
    };

    queryBalanceMutation.mutate({ clientID: clientCode, config });
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleSubmit = async () => {
    if (!isConfigured || !activeConfig) {
      toast({
        title: "Configuração Necessária",
        description: "Configure o terminal antes de processar transações.",
        variant: "destructive",
      });
      setLocation("/configuration");
      return;
    }

    // Valida que pelo menos um identificador do cliente foi fornecido
    if (!qrCodeScanned && !clientId && !phoneNumber) {
      toast({
        title: "Identificação Obrigatória",
        description: "Escaneie QR Code, digite o ID ou telefone do cliente.",
        variant: "destructive",
      });
      return;
    }

    // Valida formato do ID do Cliente (apenas 6-7 dígitos)
    if (clientId && !/^\d{6,7}$/.test(clientId)) {
      toast({
        title: "ID Inválido",
        description: "O ID deve conter apenas 6 ou 7 dígitos.",
        variant: "destructive",
      });
      return;
    }

    // Valida Número de Telefone (apenas dígitos)
    if (phoneNumber && !/^\d+$/.test(phoneNumber)) {
      toast({
        title: "Telefone Inválido",
        description: "O telefone deve conter apenas números.",
        variant: "destructive",
      });
      return;
    }

    /**
     * REGRA DE NEGÓCIO: Gerar código único do cliente
     * 
     * 3 métodos de identificação, cada um com prefixo diferente:
     * 1. QR Code: usa código completo como está (vem da API)
     * 2. ID numérico (6-7 dígitos): prefixo "0e" + SHA1 do ID
     * 3. Telefone: prefixo "0f" + SHA1 do telefone formatado
     * 
     * ============================================================================
     * FORMATAÇÃO DE TELEFONE (REGRA CRÍTICA - PADRÃO E.164)
     * ============================================================================
     * 
     * POR QUE PRECISAMOS FORMATAR?
     * - API L2Flow segue padrão E.164 (formato internacional de telefone)
     * - E.164 exige: + código país + código área + número local
     * - Exemplo completo: +556199887766 (armazenado sem '+' como "556199887766")
     * - Brasil = 55, Distrito Federal = 61, número = 99887766
     * 
     * REGRAS DE FORMATAÇÃO AUTOMÁTICA (padrão para Brasil/DF):
     * 
     * 1️⃣ 9 DÍGITOS (ex: "999887766"):
     *    → Adiciona "5561" (Brasil + DF) = "5561999887766" (13 dígitos)
     *    Assume: número de celular de Brasília sem DDD
     *    Uso comum: operadora digita apenas o número do cliente
     * 
     * 2️⃣ 11 DÍGITOS (ex: "61999887766"):
     *    → Adiciona "55" (Brasil) = "5561999887766" (13 dígitos)
     *    Assume: já tem DDD (61) mas falta código do país
     *    Uso comum: número salvo no formato nacional brasileiro
     * 
     * 3️⃣ 13 DÍGITOS (ex: "5561999887766"):
     *    → Usa como está (já completo no padrão E.164)
     *    Uso comum: número já formatado corretamente
     * 
     * ⚠️ CASOS QUE PODEM FALHAR (o que pode dar errado):
     * 
     * - Telefone com 8 dígitos (fixo antigo sem 9º dígito):
     *   → NÃO É FORMATADO! API pode rejeitar
     *   → Solução: usuário deve adicionar DDD manualmente (11 dígitos)
     * 
     * - Telefone com 10 dígitos (DDD + fixo de 8 dígitos):
     *   → NÃO É FORMATADO! API pode rejeitar
     *   → Solução: adicionar código do país (55) para 12 dígitos (também não suportado)
     *   → Melhor: pedir número completo de 13 dígitos
     * 
     * - Telefone de outra UF (ex: SP = 11):
     *   → Se usuário digitar 9 dígitos, sistema assume DF (61) = ERRADO!
     *   → Solução: usuário deve digitar com DDD (11 dígitos) ou completo (13)
     * 
     * - Telefone internacional (ex: Portugal = +351):
     *   → Sistema assume Brasil (55) = ERRADO!
     *   → Solução: usuário deve digitar com código do país (13+ dígitos)
     * 
     * POR QUE SHA1?
     * - API L2Flow não aceita telefone/ID puro, exige hash criptográfico
     * - SHA1 gera código único de 40 caracteres hexadecimais
     * - Prefixo "0e" (ID) ou "0f" (telefone) identifica tipo de origem
     * - Hash garante privacidade e unicidade do identificador
     * 
     * EXEMPLO COMPLETO:
     * Entrada usuário: "999887766" (9 dígitos)
     * → Formatação: "5561999887766" (adiciona código país+área)
     * → SHA1: "a1b2c3d4e5f6..." (40 caracteres)
     * → Resultado final: "0fa1b2c3d4e5f6..." (prefixo + hash)
     * → API recebe e valida este código único
     */
    let finalClientCode: string;
    if (qrCodeScanned) {
      // Método 1: QR Code escaneado (já vem no formato correto da API)
      finalClientCode = qrCodeScanned;
    } else if (clientId) {
      // Método 2: ID numérico manual (6-7 dígitos)
      // Formato: "0e" + SHA1(ID do cliente)
      const hash = await sha1(clientId);
      finalClientCode = `0e${hash}`;
    } else {
      // Método 3: Telefone manual (precisa de formatação + hash)
      let processedPhone = phoneNumber;
      const phoneLength = phoneNumber.length;
      
      if (phoneLength === 9) {
        // 9 dígitos: adicionar 5561 (55=Brasil, 61=DF)
        processedPhone = `5561${phoneNumber}`;
      } else if (phoneLength === 11) {
        // 11 dígitos (já tem DDD): adicionar 55 (código do país)
        processedPhone = `55${phoneNumber}`;
      }
      // 13 dígitos: usar como está (já completo)
      
      // Formato: "0f" + SHA1(telefone formatado)
      const hash = await sha1(processedPhone);
      finalClientCode = `0f${hash}`;
    }

    // Usa activeConfig diretamente (fonte unificada servidor/localStorage)
    const config = activeConfig;

    /**
     * REGRA DE NEGÓCIO: Determinar valor da transação (em REAIS)
     * 
     * IMPORTANTE: Valor aqui é em REAIS, mas será convertido para CENTAVOS no backend
     * 
     * DOIS MODOS DE OPERAÇÃO:
     * 
     * 1. Modo Pontuação (useFixedAmount = true):
     *    - Valor fixo: R$ 1,00
     *    - Usuário não digita valor
     *    - Usado para acumular pontos sem vínculo com valor de compra
     * 
     * 2. Modo Normal (useFixedAmount = false):
     *    - Usuário digita valor da compra
     *    - Valor é validado (deve ser > 0)
     *    - Usado para programas de fidelidade baseados em compras
     * 
     * CONVERSÃO PARA CENTAVOS (feita no backend):
     * Frontend envia: "15.00" (string em reais)
     * Backend converte: 15.00 * 100 = 1500 (string em centavos)
     * API recebe: "1500" no campo totalAmount
     * 
     * Por que centavos?
     * - Evita problemas de precisão com ponto flutuante
     * - API L2Flow espera valores inteiros em centavos
     * - Exemplo: R$ 1,50 = 150 centavos
     */
    let normalizedAmount: string;
    if (config.useFixedAmount === true) {
      // Modo Pontuação: valor fixo de R$ 1,00 (será 100 centavos no backend)
      normalizedAmount = "1.00";
    } else {
      // Modo Normal: usar valor digitado pelo usuário
      if (!transactionAmount || parseFloat(transactionAmount) <= 0) {
        toast({
          title: "Valor Obrigatório",
          description: "Digite o valor da transação.",
          variant: "destructive",
        });
        return;
      }
      // Formata para 2 casas decimais (ex: "15" → "15.00")
      normalizedAmount = parseFloat(transactionAmount).toFixed(2);
    }

    // Carrega produtos para a transação
    const productsString = localStorage.getItem("loyalty_products");
    let products = [];
    
    if (productsString) {
      try {
        const savedProducts = JSON.parse(productsString);
        products = savedProducts.map((p: any) => ({
          name: p.name,
          productId: p.productId,
          pCost: p.price,
          price: p.price,
          quantity: "1000",
          markupDiscount: "0",
          tax: p.tax || "20",
          barcode: p.barcode || p.productId,
          group: p.group || "4b",
          flag: "",
        }));
      } catch (error) {
        console.error("Failed to load products", error);
      }
    }

    // Verifica se está offline
    if (!navigator.onLine) {
      offlineQueue.addTransaction(finalClientCode, config, products, normalizedAmount);
      toast({
        title: "Transação na Fila",
        description: "Sem conexão. A transação será processada quando a conexão for restabelecida.",
      });
      setQrCodeScanned("");
      setClientId("");
      setPhoneNumber("");
      return;
    }

    processTransactionMutation.mutate({ 
      clientID: finalClientCode, 
      config,
      transactionAmount: normalizedAmount 
    });
  };

  const handleCashback = async () => {
    if (!isConfigured || !activeConfig) {
      toast({
        title: "Configuração Necessária",
        description: "Configure o terminal antes de processar cashback.",
        variant: "destructive",
      });
      setLocation("/configuration");
      return;
    }

    // Valida que pelo menos um identificador do cliente foi fornecido
    if (!qrCodeScanned && !clientId && !phoneNumber) {
      toast({
        title: "Identificação Obrigatória",
        description: "Escaneie QR Code, digite o ID ou telefone do cliente.",
        variant: "destructive",
      });
      return;
    }

    // Valida formato do ID do Cliente (apenas 6-7 dígitos)
    if (clientId && !/^\d{6,7}$/.test(clientId)) {
      toast({
        title: "ID Inválido",
        description: "O ID deve conter apenas 6 ou 7 dígitos.",
        variant: "destructive",
      });
      return;
    }

    // Valida Número de Telefone (apenas dígitos)
    if (phoneNumber && !/^\d+$/.test(phoneNumber)) {
      toast({
        title: "Telefone Inválido",
        description: "O telefone deve conter apenas números.",
        variant: "destructive",
      });
      return;
    }

    // Verifica se o saldo está disponível
    if (clientBalance === null) {
      toast({
        title: "Saldo Não Disponível",
        description: "Aguarde o carregamento do saldo do cliente.",
        variant: "destructive",
      });
      return;
    }

    // Abre modal de cashback
    setCashbackAmount("");
    setShowCashbackModal(true);
  };

  const processCashbackConfirm = async () => {
    if (!activeConfig) return;

    // Valida valor do cashback
    if (!cashbackAmount || parseFloat(cashbackAmount) <= 0) {
      toast({
        title: "Valor Inválido",
        description: "Digite um valor válido para o resgate.",
        variant: "destructive",
      });
      return;
    }

    // Fecha modal
    setShowCashbackModal(false);

    // Determina qual código de cliente usar
    let finalClientCode: string;
    if (qrCodeScanned) {
      finalClientCode = qrCodeScanned;
    } else if (clientId) {
      const hash = await sha1(clientId);
      finalClientCode = `0e${hash}`;
    } else {
      // Processa telefone com lógica de código país/área
      let processedPhone = phoneNumber;
      const phoneLength = phoneNumber.length;
      
      if (phoneLength === 9) {
        processedPhone = `5561${phoneNumber}`;
      } else if (phoneLength === 11) {
        processedPhone = `55${phoneNumber}`;
      }
      
      const hash = await sha1(processedPhone);
      finalClientCode = `0f${hash}`;
    }

    const config = activeConfig;

    // Usa valor do cashback do modal
    const normalizedAmount = parseFloat(cashbackAmount).toFixed(2);

    // Carrega produtos para o cashback
    const productsString = localStorage.getItem("loyalty_products");
    let products = [];
    
    if (productsString) {
      try {
        const savedProducts = JSON.parse(productsString);
        products = savedProducts.map((p: any) => ({
          name: p.name,
          productId: p.productId,
          pCost: p.price,
          price: p.price,
          quantity: "1000",
          markupDiscount: "0",
          tax: p.tax || "20",
          barcode: p.barcode || p.productId,
          group: p.group || "4b",
          flag: "",
        }));
      } catch (error) {
        console.error("Failed to load products", error);
      }
    }

    // Verifica se está offline
    if (!navigator.onLine) {
      toast({
        title: "Sem Conexão",
        description: "Cashback requer conexão com a internet.",
        variant: "destructive",
      });
      return;
    }

    processCashbackMutation.mutate({ 
      clientID: finalClientCode, 
      config,
      transactionAmount: normalizedAmount 
    });
  };

  const handleConfigPasswordSubmit = () => {
    if (configPassword === "2468") {
      setShowConfigPasswordDialog(false);
      setConfigPassword("");
      setLocation("/admin");
    } else {
      toast({
        title: "Senha Incorreta",
        description: "A senha de acesso às configurações está incorreta.",
        variant: "destructive",
      });
      setConfigPassword("");
    }
  };

  const status = processTransactionMutation.isPending || processCashbackMutation.isPending ? "Processando..." : "Pronto";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Header with User Info and Actions */}
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-muted-foreground">
              Usuário: <span className="font-medium text-foreground">{currentUser?.fullName}</span>
            </div>
            <div className="flex gap-2">
              {currentUser?.role === "admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowConfigPasswordDialog(true)}
                  data-testid="link-settings"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <img 
                src={brandingData?.logoUrl || bemLindinha} 
                alt={brandingData?.companyName || "Logo"} 
                className="h-16 w-auto object-contain"
                data-testid="img-company-logo-header"
              />
            </div>
            {brandingData?.companyName && (
              <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-company-name">
                {brandingData.companyName}
              </h2>
            )}
            <h1 className="text-2xl font-bold text-foreground mb-1">Sistema de Fidelidade</h1>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>

          {/* QR Scanner Button */}
          {!scannerActive && !qrCodeScanned && (
            <Button
              onClick={() => setScannerActive(true)}
              className="w-full h-14 text-lg mb-6 bg-primary hover:bg-primary/90"
              data-testid="button-activate-camera"
            >
              <Camera className="h-5 w-5 mr-2" />
              Escanear QR Code
            </Button>
          )}

          {/* QR Scanner */}
          {scannerActive && (
            <div className="mb-6">
              <QrScanner
                onScan={handleQrScan}
                isActive={scannerActive}
                onActiveChange={setScannerActive}
              />
              <Button
                onClick={() => setScannerActive(false)}
                variant="outline"
                className="w-full mt-4"
                data-testid="button-stop-scanner"
              >
                Parar Scanner
              </Button>
            </div>
          )}

          {/* QR Code Scanned Indicator */}
          {qrCodeScanned && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-500 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  QR Code Escaneado com Sucesso
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1 font-mono break-all">
                  {qrCodeScanned}
                </p>
              </div>
            </div>
          )}

          {/* Client ID Input */}
          {!qrCodeScanned && (
            <div className="space-y-2 mb-6">
              <Label htmlFor="client-id" className="text-sm font-medium">
                ID do Cliente
              </Label>
              <Input
                id="client-id"
                type="text"
                placeholder="Digite o ID do cliente"
                value={clientId}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                  setClientId(value);
                  if (value) setPhoneNumber("");
                }}
                maxLength={7}
                className="h-12 text-base"
                data-testid="input-client-id"
              />
            </div>
          )}

          {/* Phone Number Input */}
          {!qrCodeScanned && (
            <div className="space-y-2 mb-6">
              <Label htmlFor="phone-number" className="text-sm font-medium">
                Telefone do Cliente
              </Label>
              <Input
                id="phone-number"
                type="text"
                placeholder="Digite o telefone do cliente"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPhoneNumber(value);
                  if (value) setClientId("");
                }}
                className="h-12 text-base"
                data-testid="input-phone-number"
              />
            </div>
          )}

          {/* Client Balance Display */}
          {(qrCodeScanned || clientId || phoneNumber) && (
            <div className="mb-6">
              {isLoadingBalance ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-300 dark:border-blue-700" data-testid="loading-balance">
                  <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                    Consultando saldo...
                  </p>
                </div>
              ) : clientBalance !== null ? (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg border-2 border-blue-500" data-testid="card-client-balance">
                  <div className="text-center">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                      Saldo do Cliente
                    </p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-balance-amount">
                      R$ {clientBalance}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Transaction Amount or Fixed Mode Indicator */}
          {activeConfig?.useFixedAmount === true ? (
            <div className="mb-6 p-4 bg-muted rounded-lg border">
              <p className="text-sm text-muted-foreground text-center">
                Modo: <span className="font-semibold text-foreground">Pontuação</span>
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Valor Fixo: R$ 1,00
              </p>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              <Label htmlFor="transaction-amount" className="text-sm font-medium">
                Valor da Transação (R$)
              </Label>
              <Input
                id="transaction-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Valor"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                className="h-12 text-base"
                data-testid="input-transaction-amount"
              />
              <p className="text-xs text-muted-foreground">
                Digite o valor em reais
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={processTransactionMutation.isPending || processCashbackMutation.isPending}
            className="w-full h-14 text-lg mb-4 bg-primary hover:bg-primary/90"
            data-testid="button-submit-transaction"
          >
            {processTransactionMutation.isPending ? (
              <>Processando...</>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Enviar Venda
              </>
            )}
          </Button>

          {/* Cashback Button */}
          <Button
            onClick={handleCashback}
            disabled={processTransactionMutation.isPending || processCashbackMutation.isPending}
            className="w-full h-14 text-lg mb-4 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white"
            data-testid="button-submit-cashback"
          >
            {processCashbackMutation.isPending ? (
              <>Processando...</>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Resgatar Cash Back
              </>
            )}
          </Button>

          {/* Clear Button */}
          <Button
            onClick={handleClear}
            variant="outline"
            className="w-full h-12"
            data-testid="button-clear"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        result={transactionResult}
      />

      {/* Cashback Modal */}
      <AlertDialog open={showCashbackModal} onOpenChange={setShowCashbackModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resgatar Cash Back</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {/* Display Client Balance */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg border-2 border-blue-500">
                <div className="text-center">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                    Saldo Disponível
                  </p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    R$ {clientBalance || "0.00"}
                  </p>
                </div>
              </div>

              {/* Cashback Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="cashback-amount" className="text-sm font-medium">
                  Valor do Resgate (R$)
                </Label>
                <Input
                  id="cashback-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Digite o valor"
                  value={cashbackAmount}
                  onChange={(e) => setCashbackAmount(e.target.value)}
                  className="h-12 text-base"
                  data-testid="input-cashback-amount"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Digite o valor que deseja resgatar
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cashback">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={processCashbackConfirm}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              data-testid="button-confirm-cashback"
            >
              Confirmar Resgate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Configuration Password Dialog */}
      <AlertDialog open={showConfigPasswordDialog} onOpenChange={setShowConfigPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acesso às Configurações</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Digite a senha para acessar as configurações do sistema.</p>
              <div className="space-y-2">
                <Label htmlFor="config-password" className="text-sm font-medium">
                  Senha
                </Label>
                <Input
                  id="config-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfigPasswordSubmit();
                    }
                  }}
                  className="h-12 text-base"
                  data-testid="input-config-password"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setConfigPassword("");
                setShowConfigPasswordDialog(false);
              }}
              data-testid="button-cancel-config-password"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfigPasswordSubmit}
              data-testid="button-submit-config-password"
            >
              Acessar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
