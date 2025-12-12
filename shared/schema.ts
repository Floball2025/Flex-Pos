/**
 * SCHEMA DO BANCO DE DADOS - Drizzle ORM
 * 
 * IMPORTANTE - CONVENÇÃO DE NOMES (PECULIARIDADE DO DRIZZLE):
 * 
 * O Drizzle ORM faz conversão automática de snake_case → camelCase!
 * 
 * DEFINIÇÃO DO SCHEMA (neste arquivo):
 * - Colunas no banco: snake_case (ex: "logo_url", "primary_color")
 * - Propriedades TypeScript: camelCase (ex: logoUrl, primaryColor)
 * 
 * QUANDO USAR NO CÓDIGO:
 * ✅ CORRETO: data.logoUrl, data.primaryColor, data.companyId
 * ❌ ERRADO: data.logo_url, data.primary_color, data.company_id (retorna undefined!)
 * 
 * EXEMPLO PRÁTICO:
 * 
 * // Definição do schema (neste arquivo)
 * export const companyBranding = pgTable("company_branding", {
 *   logoUrl: text("logo_url"),          // ← Banco: logo_url
 *   primaryColor: text("primary_color") // ← Banco: primary_color
 * });
 * 
 * // No código TypeScript
 * const branding = await db.select().from(companyBranding).where(...);
 * console.log(branding.logoUrl);       // ✅ Funciona!
 * console.log(branding.logo_url);      // ❌ undefined! Drizzle já converteu
 * 
 * Por que isso acontece?
 * - Drizzle gera tipos TypeScript automaticamente
 * - Propriedade TS sempre usa o primeiro parâmetro da definição (camelCase)
 * - Segundo parâmetro é só o nome da coluna no banco (snake_case)
 * 
 * REGRA DE OURO:
 * - Ao DEFINIR schema: use camelCase na propriedade, snake_case no nome da coluna
 * - Ao USAR no código: sempre camelCase (Drizzle já fez a conversão!)
 */

import { z } from "zod";
import { pgTable, text, boolean, timestamp, integer, uuid, decimal, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// ============================================================================
// COMPANIES TABLE - Empresas do sistema multi-tenant
// ============================================================================
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(), // e.g., "Acessórios", "Restaurante", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ============================================================================
// COMPANY BRANDING TABLE
// ============================================================================
export const companyBranding = pgTable("company_branding", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"), // URL or base64 encoded logo
  primaryColor: text("primary_color").default("#3B82F6"),
  secondaryColor: text("secondary_color").default("#1E40AF"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCompany: uniqueIndex("company_branding_company_id_unique_idx").on(table.companyId),
}));

export const insertCompanyBrandingSchema = createInsertSchema(companyBranding).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCompanyBranding = z.infer<typeof insertCompanyBrandingSchema>;
export type CompanyBranding = typeof companyBranding.$inferSelect;

// ============================================================================
// TERMINALS TABLE
// ============================================================================
export const terminals = pgTable("terminals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  terminalId: text("terminal_id").notNull().unique(), // e.g., "bemL001"
  name: text("name").notNull(), // e.g., "Loja Centro", "Filial Shopping"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTerminalSchema = createInsertSchema(terminals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertTerminal = z.infer<typeof insertTerminalSchema>;
export type Terminal = typeof terminals.$inferSelect;

// ============================================================================
// COMPANY CONFIGS TABLE (API credentials shared across company)
// ============================================================================
export const companyConfigs = pgTable("company_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  host: text("host").notNull(),
  aidPass: text("aid_pass").notNull(),
  acquirerId: text("acquirer_id").notNull(),
  transactionEndpoint: text("transaction_endpoint").notNull(),
  tokenEndpoint: text("token_endpoint").notNull(),
  useFixedAmount: boolean("use_fixed_amount").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanyConfigSchema = createInsertSchema(companyConfigs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCompanyConfig = z.infer<typeof insertCompanyConfigSchema>;
export type CompanyConfig = typeof companyConfigs.$inferSelect;

// ============================================================================
// USERS TABLE
// ============================================================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }), // nullable for global admins
  username: text("username").notNull().unique(), // Username for login (e.g., "lind888")
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).default("user").notNull(), // admin = global admin, user = company user
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// CUSTOMERS TABLE (store client data per company)
// ============================================================================
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: text("client_id"), // Original QR code ID or manual ID
  phoneNumber: text("phone_number"), // Raw phone number
  phoneNumberHash: text("phone_number_hash"), // SHA1 hash for lookups
  clientCode: text("client_code").notNull(), // Final processed code (e.g., "0f...")
  lastBalance: decimal("last_balance", { precision: 10, scale: 2 }).default("0.00"),
  lastTransactionAt: timestamp("last_transaction_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueClientCodePerCompany: uniqueIndex("customers_company_id_client_code_unique_idx").on(table.companyId, table.clientCode),
}));

export const insertCustomerSchema = createInsertSchema(customers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  terminalId: uuid("terminal_id").notNull().references(() => terminals.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // who processed it
  rrn: text("rrn").notNull(), // Reference Retrieval Number
  actionType: text("action_type").notNull(), // "4" = transaction, "3" = balance, etc.
  resultCode: text("result_code").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }),
  balance: decimal("balance", { precision: 10, scale: 2 }),
  errorMessage: text("error_message"),
  requestPayload: text("request_payload"), // JSON stringified request
  responsePayload: text("response_payload"), // JSON stringified response
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ============================================================================
// TRANSACTION LINE ITEMS TABLE (optional - for product details)
// ============================================================================
export const transactionLineItems = pgTable("transaction_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionLineItemSchema = createInsertSchema(transactionLineItems).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertTransactionLineItem = z.infer<typeof insertTransactionLineItemSchema>;
export type TransactionLineItem = typeof transactionLineItems.$inferSelect;

// ============================================================================
// RELATIONS (for Drizzle ORM queries)
// ============================================================================
export const companiesRelations = relations(companies, ({ one, many }) => ({
  branding: one(companyBranding),
  config: one(companyConfigs),
  terminals: many(terminals),
  users: many(users),
  customers: many(customers),
  transactions: many(transactions),
}));

export const terminalsRelations = relations(terminals, ({ one, many }) => ({
  company: one(companies, {
    fields: [terminals.companyId],
    references: [companies.id],
  }),
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  transactions: many(transactions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, {
    fields: [customers.companyId],
    references: [companies.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  company: one(companies, {
    fields: [transactions.companyId],
    references: [companies.id],
  }),
  terminal: one(terminals, {
    fields: [transactions.terminalId],
    references: [terminals.id],
  }),
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  lineItems: many(transactionLineItems),
}));

export const transactionLineItemsRelations = relations(transactionLineItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionLineItems.transactionId],
    references: [transactions.id],
  }),
}));

// ============================================================================
// LEGACY SCHEMAS (kept for API compatibility)
// ============================================================================

// Configuration Schema
export const configurationSchema = z.object({
  host: z.string().min(1, "Host is required"),
  aid_pass: z.string().min(1, "Password is required"),
  acquirerID: z.string().min(1, "Acquirer ID is required"),
  terminalID: z.string().min(1, "Terminal ID is required"),
  transactionEndpoint: z.string().min(1, "Transaction endpoint is required"),
  tokenEndpoint: z.string().min(1, "Token endpoint is required"),
  useFixedAmount: z.boolean().default(false),
});

export type Configuration = z.infer<typeof configurationSchema>;

// Token Request Schema
export const tokenRequestSchema = z.object({
  terminalID: z.string(),
  acquirerID: z.string(),
  language: z.literal("en"),
  password: z.string(),
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

// Token Response Schema
export const tokenResponseSchema = z.object({
  token: z.string(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

// Transaction Request Schema
export const transactionRequestSchema = z.object({
  actionType: z.literal("4"),
  terminalID: z.string(),
  acquirerID: z.string(),
  created: z.string(), // YYYYMMDDHHmmssSSS
  clientID: z.string(),
  rrn: z.string(), // YYYYMMDDHHmmssSS
  totalAmount: z.literal("100"),
  additionalData: z.object({
    products: z.array(z.object({
      name: z.literal("Bem Lindinha"),
      productId: z.literal("1000100"),
      pCost: z.literal("100"),
      price: z.literal("100"),
      quantity: z.literal("1000"),
      markupDiscount: z.literal("0"),
      tax: z.literal("20"),
      barcode: z.literal("1000100"),
      group: z.literal("4b"),
      flag: z.literal(""),
    })),
    totalPcost: z.literal("100"),
  }),
  currency: z.literal("986"),
  authCode: z.literal("NUB445"),
});

export type TransactionRequest = z.infer<typeof transactionRequestSchema>;

// Transaction Response Schema
export const transactionResponseSchema = z.object({
  rrn: z.string(),
  resultCode: z.string(),
  additionalData: z.object({
    products: z.array(z.object({
      productId: z.string(),
      bonus: z.string(),
    })),
    totalPcost: z.string(),
    bonus: z.string(),
    balance: z.string(),
  }),
});

export type TransactionResponse = z.infer<typeof transactionResponseSchema>;

// Transaction History Item (for local storage)
export const transactionHistorySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  clientID: z.string(),
  rrn: z.string(),
  resultCode: z.string(),
  bonus: z.string().optional(),
  balance: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type TransactionHistory = z.infer<typeof transactionHistorySchema>;

// Input Method Type
export const inputMethodSchema = z.enum(["qr", "id", "phone"]);
export type InputMethod = z.infer<typeof inputMethodSchema>;

// Product Schema
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome é obrigatório"),
  productId: z.string().min(1, "Product ID é obrigatório"),
  price: z.string().min(1, "Preço é obrigatório"),
  barcode: z.string().optional(),
  group: z.string().default("4b"),
  tax: z.string().default("20"),
});

export type Product = z.infer<typeof productSchema>;

// ============================================================================
// AUTH SCHEMAS
// ============================================================================
export const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    role: z.enum(["admin", "user"]),
    companyId: z.string().nullable(),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// ============================================================================
// LEGACY TABLE (kept for backward compatibility during migration)
// ============================================================================
export const userConfigs = pgTable("user_configs", {
  projectId: text("project_id").notNull(),
  username: text("username").notNull(),
  host: text("host").notNull(),
  aid_pass: text("aid_pass").notNull(),
  acquirerID: text("acquirer_id").notNull(),
  terminalID: text("terminal_id").notNull(),
  transactionEndpoint: text("transaction_endpoint").notNull(),
  tokenEndpoint: text("token_endpoint").notNull(),
  useFixedAmount: boolean("use_fixed_amount").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "user_configs_project_id_username_pk",
    columns: [table.projectId, table.username]
  }
}));

export const insertUserConfigSchema = createInsertSchema(userConfigs).omit({ updatedAt: true });
export type InsertUserConfig = z.infer<typeof insertUserConfigSchema>;
export type UserConfig = typeof userConfigs.$inferSelect;
