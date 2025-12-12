import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateCreatedTimestamp, generateRRNTimestamp } from "./utils/timestamps";
import { authenticateToken, type AuthRequest } from "./auth";
import { 
  type Configuration, 
  type TokenRequest, 
  type TokenResponse,
  type TransactionRequest,
  type TransactionResponse,
  type TransactionHistory,
  configurationSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Endpoint para processar transação (protegido)
  app.post("/api/transaction", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientID, config, products, transactionAmount } = req.body;

      console.log("\n📥 JSON RECEBIDO:");
      console.log(JSON.stringify(req.body, null, 2));

      if (!clientID || !config) {
        return res.status(400).json({ 
          error: "clientID and config are required" 
        });
      }

      // Obtém empresa do usuário autenticado
      const companyId = req.user!.companyId;
      const userId = req.user!.id;

      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      // Valida configuração
      const validatedConfig = configurationSchema.parse(config);

      // Obtém terminal do banco de dados
      const terminal = await storage.getTerminalByCompany(companyId, validatedConfig.terminalID);
      if (!terminal) {
        return res.status(404).json({ 
          error: `Terminal ${validatedConfig.terminalID} not found for your company` 
        });
      }

      // Usa valor fornecido da transação ou calcula dos produtos
      const totalAmount = transactionAmount 
        ? Math.round(parseFloat(transactionAmount.replace(',', '.')) * 100).toString() // Converte R$ para centavos (trata vírgula decimal)
        : "100"; // padrão 1 real = 100 centavos
      
      // Carrega produtos da requisição ou usa padrão com totalAmount correto
      const transactionProducts = products && products.length > 0 
        ? products.map((p: any) => ({
            ...p,
            pCost: totalAmount,  // Usa totalAmount em centavos
            price: totalAmount,  // Usa totalAmount em centavos
            quantity: "1000"     // Sempre 1000
          }))
        : [{
            name: "Bem Lindinha",
            productId: "1000100",
            pCost: totalAmount,
            price: totalAmount,
            quantity: "1000",
            markupDiscount: "0",
            tax: "20",
            barcode: "1000100",
            group: "4b",
            flag: "",
          }];

      // Passo 1: Requisita token de autenticação
      const tokenRequest: TokenRequest = {
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        language: "en",
        password: validatedConfig.aid_pass,
      };

      let token: string;
      try {
        const tokenResponse = await fetch(`${validatedConfig.host}${validatedConfig.tokenEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tokenRequest),
        });

        if (!tokenResponse.ok) {
          // Tenta obter detalhes do erro do corpo da resposta
          let errorDetails = tokenResponse.statusText;
          try {
            const errorBody = await tokenResponse.text();
            errorDetails = errorBody || tokenResponse.statusText;
          } catch (e) {
            // Ignora erro de parse
          }
          
          throw new Error(`Token request failed: ${tokenResponse.statusText} - ${errorDetails}`);
        }

        const tokenData: TokenResponse = await tokenResponse.json();
        token = tokenData.token;
      } catch (error: any) {
        console.error("TOKEN REQUEST ERROR:", error);
        return res.status(500).json({ 
          error: "Failed to obtain authentication token",
          details: error.message,
          requestPayload: {
            terminalID: tokenRequest.terminalID,
            acquirerID: tokenRequest.acquirerID,
            language: tokenRequest.language,
            password: tokenRequest.password ? "***PROVIDED***" : "***MISSING***"
          }
        });
      }

      // Passo 2: Constrói e submete transação
      const created = generateCreatedTimestamp();
      const rrn = generateRRNTimestamp();

      const transactionRequest: any = {
        actionType: "4", // Tipo de ação 4 para vendas regulares
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        created,
        clientID,
        rrn,
        totalAmount,
        additionalData: {
          products: transactionProducts,
          totalPcost: totalAmount,
        },
        currency: "986",
        authCode: "NUB445",
      };

      console.log("\n📤 JSON ENVIADO PARA API:");
      console.log(JSON.stringify(transactionRequest, null, 2));

      let transactionResponse: any;
      try {
        const txResponse = await fetch(`${validatedConfig.host}${validatedConfig.transactionEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(transactionRequest),
        });

        transactionResponse = await txResponse.json();

        // Encontra ou cria cliente
        const customer = await storage.findOrCreateCustomer(companyId, clientID, {
          clientId: clientID,
        });

        // Verifica se transação foi bem-sucedida
        if (!txResponse.ok) {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: transactionResponse.rrn || rrn,
              actionType: "4",
              resultCode: transactionResponse.resultCode || "ERROR",
              totalAmount,
              errorMessage: transactionResponse.error || `HTTP ${txResponse.status}: ${txResponse.statusText}`,
              requestPayload: JSON.stringify(transactionRequest),
              responsePayload: JSON.stringify(transactionResponse),
            }
          );

          return res.status(txResponse.status).json({ 
            error: transactionResponse.error || "Transaction failed",
            resultCode: transactionResponse.resultCode,
            details: transactionResponse.details || txResponse.statusText
          });
        }

        // Verifica código de resultado
        if (transactionResponse.resultCode !== "00") {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: transactionResponse.rrn || rrn,
              actionType: "4",
              resultCode: transactionResponse.resultCode,
              totalAmount,
              errorMessage: `Transaction rejected with code: ${transactionResponse.resultCode}`,
              requestPayload: JSON.stringify(transactionRequest),
              responsePayload: JSON.stringify(transactionResponse),
            }
          );

          return res.status(400).json({ 
            error: `Transaction rejected: ${transactionResponse.resultCode}`,
            resultCode: transactionResponse.resultCode,
            rrn: transactionResponse.rrn
          });
        }

      } catch (error: any) {
        // Tenta encontrar/criar cliente mesmo em caso de erro
        let customerId: string | null = null;
        try {
          const customer = await storage.findOrCreateCustomer(companyId, clientID, {
            clientId: clientID,
          });
          customerId = customer.id;
        } catch (e) {
          // Criação de cliente falhou, continua sem ele
        }

        await storage.saveTransaction(
          companyId,
          terminal.id,
          userId,
          customerId,
          {
            rrn,
            actionType: "4",
            resultCode: "ERROR",
            totalAmount,
            errorMessage: error.message,
            requestPayload: JSON.stringify(transactionRequest),
          }
        );

        return res.status(500).json({ 
          error: "Failed to process transaction",
          details: error.message 
        });
      }

      // Passo 3: Salva histórico de transação bem-sucedida
      const customer = await storage.findOrCreateCustomer(companyId, clientID, {
        clientId: clientID,
      });

      const savedTransaction = await storage.saveTransaction(
        companyId,
        terminal.id,
        userId,
        customer.id,
        {
          rrn: transactionResponse.rrn,
          actionType: "4",
          resultCode: transactionResponse.resultCode,
          totalAmount,
          bonus: transactionResponse.additionalData?.bonus,
          balance: transactionResponse.additionalData?.balance,
          requestPayload: JSON.stringify(transactionRequest),
          responsePayload: JSON.stringify(transactionResponse),
        }
      );

      // Atualiza saldo do cliente se fornecido
      if (transactionResponse.additionalData?.balance) {
        await storage.updateCustomerBalance(customer.id, transactionResponse.additionalData.balance);
      }

      // Retorna resposta bem-sucedida
      console.log("\n📨 RESPOSTA RECEBIDA DA API:");
      console.log(JSON.stringify(transactionResponse, null, 2));
      console.log("");
      
      return res.json(transactionResponse);

    } catch (error: any) {
      console.error("Transaction error:", error);
      return res.status(500).json({ 
        error: "Internal server error",
        details: error.message 
      });
    }
  });

  /**
   * POST /api/balance - Consulta saldo do cliente na API L2Flow
   * 
   * FLUXO DE AUTENTICAÇÃO MULTI-TENANT:
   * 1. Verifica JWT do usuário autenticado
   * 2. Valida que o terminal pertence à empresa do usuário
   * 3. Obtém token JWT da API L2Flow
   * 4. Faz consulta de saldo
   * 5. Salva histórico no banco de dados
   * 
   * IMPORTANTE - DIFERENÇAS DA CONSULTA DE SALDO:
   * - ActionType "3" (não confundir com "4" de venda ou "8" de cashback)
   * - NÃO deve ter campo "rrn" no request (adicionar rrn causa erro 71!)
   * - Não tem campo "totalAmount" (é consulta, não transação)
   * - Não tem campo "products" ou "additionalData"
   * 
   * REGRAS DE NEGÓCIO:
   * - Cada consulta é registrada no histórico (para auditoria)
   * - Saldo retorna em centavos (ex: "100" = R$ 1,00)
   * - Frontend converte centavos → reais para exibição
   * 
   * @param clientID - ID do cliente (formato: "0e+SHA1" ou "0f+SHA1")
   * @param config - Configuração do terminal (host, credentials, endpoints)
   * @returns Saldo do cliente em centavos + dados adicionais
   */
  app.post("/api/balance", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientID, config } = req.body;

      console.log("\n📥 CONSULTA DE SALDO - JSON RECEBIDO:");
      console.log(JSON.stringify({ clientID, config: { ...config, aid_pass: "***REDACTED***" } }, null, 2));

      if (!clientID || !config) {
        return res.status(400).json({ 
          error: "clientID and config are required" 
        });
      }

      // MULTI-TENANT: Extrai empresa do usuário autenticado via JWT
      // Garante que usuário só acessa dados da própria empresa
      const companyId = req.user!.companyId;
      const userId = req.user!.id;

      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      // Valida estrutura do config usando Zod schema
      const validatedConfig = configurationSchema.parse(config);

      // SEGURANÇA MULTI-TENANT: Verifica que terminal pertence à empresa do usuário
      // Previne acesso a terminais de outras empresas
      const terminal = await storage.getTerminalByCompany(companyId, validatedConfig.terminalID);
      if (!terminal) {
        return res.status(404).json({ 
          error: `Terminal ${validatedConfig.terminalID} not found for your company` 
        });
      }

      // PASSO 1: Obter token JWT da API L2Flow
      // Cada requisição precisa de um novo token (expiram rapidamente)
      const tokenRequest: TokenRequest = {
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        language: "en",
        password: validatedConfig.aid_pass,  // Senha do terminal (não do usuário!)
      };

      let token: string;
      try {
        const tokenResponse = await fetch(`${validatedConfig.host}${validatedConfig.tokenEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tokenRequest),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token request failed: ${tokenResponse.statusText}`);
        }

        const tokenData: TokenResponse = await tokenResponse.json();
        token = tokenData.token;
      } catch (error: any) {
        console.error("TOKEN REQUEST ERROR:", error);
        return res.status(500).json({ 
          error: "Failed to obtain authentication token",
          details: error.message
        });
      }

      // PASSO 2: Montar requisição de consulta de saldo (actionType 3)
      // 
      // CAMPOS OBRIGATÓRIOS:
      // - actionType: "3" (consulta de saldo)
      // - terminalID: ID do terminal (ex: "bemL001")
      // - acquirerID: ID do adquirente (ex: "L2Flow")
      // - created: Timestamp no formato YYYYMMDDHHmmssSSS (17 dígitos, horário de Brasília)
      // - clientID: ID do cliente (ex: "0eed2992081af78066bd2e4f8026cf32c4124de1ca")
      //
      // CAMPOS QUE NÃO DEVEM EXISTIR:
      // - rrn: ERRO CRÍTICO! Adicionar rrn em consulta de saldo causa erro 71 na API
      // - totalAmount: Não faz sentido em consulta (só em transações)
      // - products: Não faz sentido em consulta (só em transações)
      const created = generateCreatedTimestamp();

      const balanceRequest: any = {
        actionType: "3",  // Tipo de ação 3 = Consulta de saldo (não confundir com 4 ou 8!)
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        created,  // Timestamp de 17 dígitos em horário de Brasília
        clientID,
        // NOTA: NÃO adicionar campo "rrn" aqui! Causa erro 71 da API
      };

      console.log("\n📤 CONSULTA DE SALDO - JSON ENVIADO PARA API:");
      console.log(JSON.stringify(balanceRequest, null, 2));

      let balanceResponse: any;
      try {
        const txResponse = await fetch(`${validatedConfig.host}${validatedConfig.transactionEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(balanceRequest),
        });

        balanceResponse = await txResponse.json();

        console.log("\n📨 CONSULTA DE SALDO - RESPOSTA DA API:");
        console.log(JSON.stringify(balanceResponse, null, 2));
        console.log("");

        // Encontra ou cria cliente
        const customer = await storage.findOrCreateCustomer(companyId, clientID, {
          clientId: clientID,
        });

        if (!txResponse.ok) {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: balanceResponse.rrn || "NONE",
              actionType: "3",
              resultCode: balanceResponse.resultCode || "ERROR",
              totalAmount: "0",
              errorMessage: balanceResponse.error || `HTTP ${txResponse.status}`,
              requestPayload: JSON.stringify(balanceRequest),
              responsePayload: JSON.stringify(balanceResponse),
            }
          );

          return res.status(txResponse.status).json({ 
            error: balanceResponse.error || "Balance query failed",
            resultCode: balanceResponse.resultCode,
            details: balanceResponse.details || txResponse.statusText
          });
        }

        // Verifica código de resultado
        if (balanceResponse.resultCode !== "00") {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: balanceResponse.rrn || "NONE",
              actionType: "3",
              resultCode: balanceResponse.resultCode,
              totalAmount: "0",
              errorMessage: `Balance query rejected: ${balanceResponse.resultCode}`,
              requestPayload: JSON.stringify(balanceRequest),
              responsePayload: JSON.stringify(balanceResponse),
            }
          );

          return res.status(400).json({ 
            error: `Balance query rejected: ${balanceResponse.resultCode}`,
            resultCode: balanceResponse.resultCode,
            rrn: balanceResponse.rrn
          });
        }

        // Save successful balance query
        await storage.saveTransaction(
          companyId,
          terminal.id,
          userId,
          customer.id,
          {
            rrn: balanceResponse.rrn || "NONE",
            actionType: "3",
            resultCode: balanceResponse.resultCode,
            totalAmount: "0",
            balance: balanceResponse.additionalData?.balance,
            requestPayload: JSON.stringify(balanceRequest),
            responsePayload: JSON.stringify(balanceResponse),
          }
        );

        // Atualiza saldo do cliente se fornecido
        if (balanceResponse.additionalData?.balance) {
          await storage.updateCustomerBalance(customer.id, balanceResponse.additionalData.balance);
        }

      } catch (error: any) {
        return res.status(500).json({ 
          error: "Failed to query balance",
          details: error.message 
        });
      }

      // Return balance response
      return res.json(balanceResponse);

    } catch (error: any) {
      console.error("Balance query error:", error);
      return res.status(500).json({ 
        error: "Internal server error",
        details: error.message 
      });
    }
  });

  // Process cashback (actionType 8) endpoint (protected)
  app.post("/api/cashback", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientID, config, products, transactionAmount } = req.body;

      console.log("\n📥 JSON RECEBIDO (CASHBACK):");
      console.log(JSON.stringify(req.body, null, 2));

      if (!clientID || !config) {
        return res.status(400).json({ 
          error: "clientID and config are required" 
        });
      }

      // Obtém empresa do usuário autenticado
      const companyId = req.user!.companyId;
      const userId = req.user!.id;

      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      // Valida configuração
      const validatedConfig = configurationSchema.parse(config);

      // Verify terminal belongs to user's company
      const terminal = await storage.getTerminalByCompany(companyId, validatedConfig.terminalID);
      if (!terminal) {
        return res.status(404).json({ 
          error: `Terminal ${validatedConfig.terminalID} not found for your company` 
        });
      }

      // Use provided transaction amount or calculate from products
      const totalAmount = transactionAmount 
        ? Math.round(parseFloat(transactionAmount.replace(',', '.')) * 100).toString() // Convert R$ to centavos
        : "100"; // default 1 real = 100 centavos
      
      // Load products from request or use default with correct totalAmount
      const transactionProducts = products && products.length > 0 
        ? products.map((p: any) => ({
            ...p,
            pCost: totalAmount,  // Usa totalAmount em centavos
            price: totalAmount,  // Usa totalAmount em centavos
            quantity: "1000"     // Sempre 1000
          }))
        : [{
            name: "Bem Lindinha",
            productId: "1000100",
            pCost: totalAmount,
            price: totalAmount,
            quantity: "1000",
            markupDiscount: "0",
            tax: "20",
            barcode: "1000100",
            group: "4b",
            flag: "",
          }];

      // Passo 1: Requisita token de autenticação
      const tokenRequest: TokenRequest = {
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        language: "en",
        password: validatedConfig.aid_pass,
      };

      let token: string;
      try {
        const tokenResponse = await fetch(`${validatedConfig.host}${validatedConfig.tokenEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tokenRequest),
        });

        if (!tokenResponse.ok) {
          let errorDetails = tokenResponse.statusText;
          try {
            const errorBody = await tokenResponse.text();
            errorDetails = errorBody || tokenResponse.statusText;
          } catch (e) {
            // Ignora erro de parse
          }
          
          throw new Error(`Token request failed: ${tokenResponse.statusText} - ${errorDetails}`);
        }

        const tokenData: TokenResponse = await tokenResponse.json();
        token = tokenData.token;
      } catch (error: any) {
        console.error("TOKEN REQUEST ERROR:", error);
        return res.status(500).json({ 
          error: "Failed to obtain authentication token",
          details: error.message
        });
      }

      // Step 2: Build and submit cashback transaction (actionType 8)
      const created = generateCreatedTimestamp();
      const rrn = generateRRNTimestamp();

      const transactionRequest: any = {
        actionType: "8", // Tipo de ação 8 para resgate de cashback
        terminalID: validatedConfig.terminalID,
        acquirerID: validatedConfig.acquirerID,
        created,
        clientID,
        rrn,
        totalAmount,
        additionalData: {
          products: transactionProducts,
          totalPcost: totalAmount,
        },
        currency: "986",
        authCode: "NUB445",
      };

      console.log("\n📤 JSON ENVIADO PARA API (CASHBACK):");
      console.log(JSON.stringify(transactionRequest, null, 2));

      let transactionResponse: any;
      try {
        const txResponse = await fetch(`${validatedConfig.host}${validatedConfig.transactionEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(transactionRequest),
        });

        transactionResponse = await txResponse.json();

        // Encontra ou cria cliente
        const customer = await storage.findOrCreateCustomer(companyId, clientID, {
          clientId: clientID,
        });

        if (!txResponse.ok) {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: transactionResponse.rrn || rrn,
              actionType: "8",
              resultCode: transactionResponse.resultCode || "ERROR",
              totalAmount,
              errorMessage: transactionResponse.error || `HTTP ${txResponse.status}`,
              requestPayload: JSON.stringify(transactionRequest),
              responsePayload: JSON.stringify(transactionResponse),
            }
          );

          return res.status(txResponse.status).json({ 
            error: transactionResponse.error || "Cashback failed",
            resultCode: transactionResponse.resultCode,
            details: transactionResponse.details || txResponse.statusText
          });
        }

        if (transactionResponse.resultCode !== "00") {
          await storage.saveTransaction(
            companyId,
            terminal.id,
            userId,
            customer.id,
            {
              rrn: transactionResponse.rrn || rrn,
              actionType: "8",
              resultCode: transactionResponse.resultCode,
              totalAmount,
              errorMessage: `Cashback rejected: ${transactionResponse.resultCode}`,
              requestPayload: JSON.stringify(transactionRequest),
              responsePayload: JSON.stringify(transactionResponse),
            }
          );

          return res.status(400).json({ 
            error: `Cashback rejected: ${transactionResponse.resultCode}`,
            resultCode: transactionResponse.resultCode,
            rrn: transactionResponse.rrn
          });
        }

      } catch (error: any) {
        // Tenta encontrar/criar cliente mesmo em caso de erro
        let customerId: string | null = null;
        try {
          const customer = await storage.findOrCreateCustomer(companyId, clientID, {
            clientId: clientID,
          });
          customerId = customer.id;
        } catch (e) {
          // Criação de cliente falhou, continua sem ele
        }

        await storage.saveTransaction(
          companyId,
          terminal.id,
          userId,
          customerId,
          {
            rrn,
            actionType: "8",
            resultCode: "ERROR",
            totalAmount,
            errorMessage: error.message,
            requestPayload: JSON.stringify(transactionRequest),
          }
        );

        return res.status(500).json({ 
          error: "Failed to process cashback",
          details: error.message 
        });
      }

      // Step 3: Save successful cashback history
      const customer = await storage.findOrCreateCustomer(companyId, clientID, {
        clientId: clientID,
      });

      await storage.saveTransaction(
        companyId,
        terminal.id,
        userId,
        customer.id,
        {
          rrn: transactionResponse.rrn,
          actionType: "8",
          resultCode: transactionResponse.resultCode,
          totalAmount,
          bonus: transactionResponse.additionalData?.bonus,
          balance: transactionResponse.additionalData?.balance,
          requestPayload: JSON.stringify(transactionRequest),
          responsePayload: JSON.stringify(transactionResponse),
        }
      );

      // Atualiza saldo do cliente se fornecido
      if (transactionResponse.additionalData?.balance) {
        await storage.updateCustomerBalance(customer.id, transactionResponse.additionalData.balance);
      }

      console.log("\n📨 RESPOSTA RECEBIDA DA API (CASHBACK):");
      console.log(JSON.stringify(transactionResponse, null, 2));
      console.log("");
      
      return res.json(transactionResponse);

    } catch (error: any) {
      console.error("Cashback error:", error);
      return res.status(500).json({ 
        error: "Internal server error",
        details: error.message 
      });
    }
  });

  // Get transaction history (protected)
  app.get("/api/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      const transactions = await storage.getTransactions(companyId);
      
      // Converte para formato legado para compatibilidade com frontend
      const legacyTransactions = transactions.map(t => ({
        id: t.id,
        timestamp: t.createdAt.toISOString(),
        clientID: t.customerId || "unknown",
        rrn: t.rrn,
        resultCode: t.resultCode,
        bonus: t.bonus || undefined,
        balance: t.balance || undefined,
        errorMessage: t.errorMessage || undefined,
      }));

      return res.json(legacyTransactions);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ 
        error: "Failed to fetch transactions",
        details: error.message 
      });
    }
  });

  // Export transactions as CSV (protected)
  app.post("/api/transactions/export/csv", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { transactions } = req.body;
      
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: "Invalid transactions data" });
      }

      const { generateCSV } = await import("./utils/export");
      const csv = generateCSV(transactions);
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="transacoes_${Date.now()}.csv"`);
      return res.send(csv);
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      return res.status(500).json({ 
        error: "Failed to export CSV",
        details: error.message 
      });
    }
  });

  // Export transactions as PDF (HTML) (protected)
  app.post("/api/transactions/export/pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { transactions } = req.body;
      
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: "Invalid transactions data" });
      }

      const { generatePDFHTML } = await import("./utils/export");
      const html = generatePDFHTML(transactions);
      
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      return res.status(500).json({ 
        error: "Failed to export PDF",
        details: error.message 
      });
    }
  });

  /**
   * GET /api/branding - Retorna branding (logo, nome, cores) da empresa do usuário
   * 
   * SISTEMA MULTI-TENANT:
   * - Cada empresa tem seu próprio branding personalizado
   * - Logo armazenado como base64 no banco de dados
   * - Cores primária e secundária para personalização da UI
   * 
   * IMPORTANTE - QUIRK DO DRIZZLE ORM:
   * Drizzle ORM converte automaticamente snake_case → camelCase!
   * Banco de dados: logo_url, primary_color, secondary_color
   * JavaScript/TypeScript: logoUrl, primaryColor, secondaryColor
   * 
   * ERRO COMUM:
   * ❌ companyData.branding?.logo_url (undefined!)
   * ✅ companyData.branding?.logoUrl (correto!)
   * 
   * Se você tentar acessar "logo_url" vai retornar undefined, porque
   * o Drizzle já fez a conversão para camelCase automaticamente.
   * 
   * SEGURANÇA:
   * - Usuário só acessa branding da própria empresa (via JWT)
   * - CompanyId extraído do token de autenticação
   * 
   * @returns {companyName, logoUrl, primaryColor, secondaryColor}
   */
  app.get("/api/branding", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // MULTI-TENANT: CompanyId vem do JWT do usuário autenticado
      const companyId = req.user!.companyId;
      
      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      // Busca dados da empresa com branding incluído (via Drizzle relations)
      const companyData = await storage.getCompanyById(companyId);
      
      if (!companyData) {
        return res.status(404).json({ error: "Company not found" });
      }

      /**
       * IMPORTANTE: SEMPRE use camelCase ao acessar dados do Drizzle!
       * 
       * ❌ ERRO COMUM (retorna undefined):
       * companyData.branding?.logo_url
       * companyData.branding?.primary_color
       * 
       * ✅ CORRETO (Drizzle já converteu snake_case → camelCase):
       * companyData.branding?.logoUrl
       * companyData.branding?.primaryColor
       * 
       * BUG JÁ ENCONTRADO EM PRODUÇÃO:
       * - Logo não aparecia porque usávamos logo_url (undefined)
       * - Cores não aplicavam porque usávamos primary_color (undefined)
       * - Solução: sempre camelCase quando acessando dados do Drizzle
       * 
       * Ver shared/schema.ts (cabeçalho) para documentação completa desta peculiaridade.
       */
      return res.json({
        companyName: companyData.name,
        logoUrl: companyData.branding?.logoUrl || null,  // Drizzle: logo_url → logoUrl
        primaryColor: companyData.branding?.primaryColor || null,  // Drizzle: primary_color → primaryColor
        secondaryColor: companyData.branding?.secondaryColor || null,  // Drizzle: secondary_color → secondaryColor
      });
    } catch (error: any) {
      console.error("Error fetching company branding:", error);
      return res.status(500).json({ 
        error: "Failed to fetch branding",
        details: error.message 
      });
    }
  });

  // Get user configuration (protected) - returns company config
  app.get("/api/config/:username", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      const config = await storage.getCompanyConfigWithTerminal(companyId);
      
      if (!config) {
        return res.status(404).json({ 
          error: "Configuration not found for your company. Please contact administrator." 
        });
      }

      return res.json(config);
    } catch (error: any) {
      console.error("Error fetching company config:", error);
      return res.status(500).json({ 
        error: "Failed to fetch configuration",
        details: error.message 
      });
    }
  });

  // Save user configuration (protected) - updates company config (admin only)
  app.post("/api/config/:username", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      
      if (!companyId) {
        return res.status(403).json({ error: "User not associated with a company" });
      }

      // Only admins can modify company config
      if (req.user!.role !== "admin") {
        return res.status(403).json({ 
          error: "Only administrators can modify company configuration" 
        });
      }

      // Valida configuração
      const validatedConfig = configurationSchema.parse(req.body);

      const savedConfig = await storage.setCompanyConfig(companyId, validatedConfig);
      
      console.log(`Configuration saved for company: ${companyId}`);
      
      return res.json(savedConfig);
    } catch (error: any) {
      console.error("Error saving company config:", error);
      return res.status(400).json({ 
        error: "Failed to save configuration",
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
