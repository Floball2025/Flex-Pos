import { 
  type Transaction, 
  type InsertTransaction,
  type InsertTransactionLineItem,
  type Customer,
  type InsertCustomer,
  type Terminal,
  type CompanyConfig,
  transactions,
  transactionLineItems,
  customers,
  terminals,
  companyConfigs,
  companies,
  companyBranding,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Legacy Configuration interface for backward compatibility
export interface Configuration {
  host: string;
  aid_pass: string;
  acquirerID: string;
  terminalID: string;
  transactionEndpoint: string;
  tokenEndpoint: string;
  useFixedAmount: boolean;
}

// Legacy TransactionHistory interface for backward compatibility
export interface TransactionHistory {
  id: string;
  timestamp: string;
  clientID: string;
  rrn: string;
  resultCode: string;
  bonus?: string;
  balance?: string;
}

export interface IStorage {
  // Transaction methods
  saveTransaction(
    companyId: string,
    terminalId: string,
    userId: string | null,
    customerId: string | null,
    data: {
      rrn: string;
      actionType: string;
      resultCode: string;
      totalAmount: string;
      bonus?: string;
      balance?: string;
      errorMessage?: string;
      requestPayload?: string;
      responsePayload?: string;
    }
  ): Promise<Transaction>;
  
  getTransactions(companyId: string, limit?: number): Promise<Transaction[]>;
  
  // Customer methods
  findOrCreateCustomer(
    companyId: string,
    clientCode: string,
    data?: {
      clientId?: string;
      phoneNumber?: string;
      phoneNumberHash?: string;
    }
  ): Promise<Customer>;
  
  updateCustomerBalance(customerId: string, balance: string): Promise<void>;
  
  // Configuration methods
  getCompanyConfig(companyId: string): Promise<Configuration | null>;
  getTerminal(terminalId: string): Promise<Terminal | null>;
  getTerminalByCompany(companyId: string, terminalId: string): Promise<Terminal | null>;
  getCompanyConfigWithTerminal(companyId: string): Promise<Configuration | null>;
  setCompanyConfig(companyId: string, config: Configuration): Promise<Configuration>;
  
  // Company methods
  getCompanyById(companyId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async saveTransaction(
    companyId: string,
    terminalDbId: string,
    userId: string | null,
    customerId: string | null,
    data: {
      rrn: string;
      actionType: string;
      resultCode: string;
      totalAmount: string;
      bonus?: string;
      balance?: string;
      errorMessage?: string;
      requestPayload?: string;
      responsePayload?: string;
    }
  ): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({
        companyId,
        terminalId: terminalDbId,
        userId,
        customerId,
        rrn: data.rrn,
        actionType: data.actionType,
        resultCode: data.resultCode,
        totalAmount: data.totalAmount,
        bonus: data.bonus || null,
        balance: data.balance || null,
        errorMessage: data.errorMessage || null,
        requestPayload: data.requestPayload || null,
        responsePayload: data.responsePayload || null,
      })
      .returning();
    
    return transaction;
  }

  async getTransactions(companyId: string, limit: number = 100): Promise<Transaction[]> {
    const results = await db
      .select()
      .from(transactions)
      .where(eq(transactions.companyId, companyId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    
    return results;
  }

  async findOrCreateCustomer(
    companyId: string,
    clientCode: string,
    data?: {
      clientId?: string;
      phoneNumber?: string;
      phoneNumberHash?: string;
    }
  ): Promise<Customer> {
    // Try to find existing customer
    const [existing] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.companyId, companyId),
          eq(customers.clientCode, clientCode)
        )
      );
    
    if (existing) {
      return existing;
    }

    // Create new customer
    const [newCustomer] = await db
      .insert(customers)
      .values({
        companyId,
        clientId: data?.clientId || null,
        phoneNumber: data?.phoneNumber || null,
        phoneNumberHash: data?.phoneNumberHash || null,
        clientCode,
        lastBalance: "0.00",
      })
      .returning();
    
    return newCustomer;
  }

  async updateCustomerBalance(customerId: string, balance: string): Promise<void> {
    await db
      .update(customers)
      .set({
        lastBalance: balance,
        lastTransactionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  }

  async getCompanyConfig(companyId: string): Promise<Configuration | null> {
    const [config] = await db
      .select()
      .from(companyConfigs)
      .where(eq(companyConfigs.companyId, companyId));
    
    if (!config) {
      return null;
    }

    return {
      host: config.host,
      aid_pass: config.aidPass,
      acquirerID: config.acquirerId,
      terminalID: "", // Will be filled from terminal
      transactionEndpoint: config.transactionEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      useFixedAmount: config.useFixedAmount,
    };
  }

  async getTerminal(terminalId: string): Promise<Terminal | null> {
    const [terminal] = await db
      .select()
      .from(terminals)
      .where(eq(terminals.terminalId, terminalId));
    
    return terminal || null;
  }

  async getTerminalByCompany(companyId: string, terminalId: string): Promise<Terminal | null> {
    const [terminal] = await db
      .select()
      .from(terminals)
      .where(
        and(
          eq(terminals.companyId, companyId),
          eq(terminals.terminalId, terminalId)
        )
      );
    
    return terminal || null;
  }

  async getCompanyConfigWithTerminal(companyId: string): Promise<Configuration | null> {
    // Get company config
    const config = await this.getCompanyConfig(companyId);
    if (!config) {
      return null;
    }

    // Get first active terminal
    const [terminal] = await db
      .select()
      .from(terminals)
      .where(
        and(
          eq(terminals.companyId, companyId),
          eq(terminals.isActive, true)
        )
      )
      .limit(1);

    if (!terminal) {
      return null;
    }

    return {
      ...config,
      terminalID: terminal.terminalId,
    };
  }

  async setCompanyConfig(companyId: string, config: Configuration): Promise<Configuration> {
    await db
      .insert(companyConfigs)
      .values({
        companyId,
        host: config.host,
        aidPass: config.aid_pass,
        acquirerId: config.acquirerID,
        transactionEndpoint: config.transactionEndpoint,
        tokenEndpoint: config.tokenEndpoint,
        useFixedAmount: config.useFixedAmount,
      })
      .onConflictDoUpdate({
        target: companyConfigs.companyId,
        set: {
          host: config.host,
          aidPass: config.aid_pass,
          acquirerId: config.acquirerID,
          transactionEndpoint: config.transactionEndpoint,
          tokenEndpoint: config.tokenEndpoint,
          useFixedAmount: config.useFixedAmount,
          updatedAt: new Date(),
        },
      });

    return config;
  }

  async getCompanyById(companyId: string): Promise<any> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return null;
    }

    // Get branding if it exists
    const [branding] = await db
      .select()
      .from(companyBranding)
      .where(eq(companyBranding.companyId, companyId))
      .limit(1);

    return {
      ...company,
      branding: branding || null,
    };
  }
}

export const storage = new DatabaseStorage();
