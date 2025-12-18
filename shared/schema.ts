import { z } from "zod";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  decimal,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// ============================================================================
// COMPANIES TABLE - Empresas do sistema multi-tenant
// ============================================================================
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ============================================================================
// COMPANY BRANDING TABLE
// ============================================================================
export const companyBranding = pgTable(
  "company_branding",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").default("#3B82F6"),
    secondaryColor: text("secondary_color").default("#1E40AF"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCompany: uniqueIndex("company_branding_company_id_unique_idx").on(
      table.companyId
    ),
  })
);

export const insertCompanyBrandingSchema = createInsertSchema(companyBranding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyBranding = z.infer<typeof insertCompanyBrandingSchema>;
export type CompanyBranding = typeof companyBranding.$inferSelect;

// ============================================================================
// TERMINALS TABLE
// ============================================================================
export const terminals = pgTable("terminals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  terminalId: text("terminal_id").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTerminalSchema = createInsertSchema(terminals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTerminal = z.infer<typeof insertTerminalSchema>;
export type Terminal = typeof terminals.$inferSelect;

// ============================================================================
// COMPANY CONFIGS TABLE
// ============================================================================
export const companyConfigs = pgTable("company_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" })
    .unique(),
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
  updatedAt: true,
});
export type InsertCompanyConfig = z.infer<typeof insertCompanyConfigSchema>;
export type CompanyConfig = typeof companyConfigs.$inferSelect;

// ============================================================================
// USERS TABLE
// ============================================================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }), // nullable for global admins
  username: text("username").notNull().unique(),

  // ✅ TS camelCase / DB snake_case
  passwordHash: text("password_hash").notNull(),

  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).default("user").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// CUSTOMERS TABLE
// ============================================================================
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    phoneNumber: text("phone_number"),
    phoneNumberHash: text("phone_number_hash"),
    clientCode: text("client_code").notNull(),
    lastBalance: decimal("last_balance", { precision: 10, scale: 2 }).default("0.00"),
    lastTransactionAt: timestamp("last_transaction_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueClientCodePerCompany: uniqueIndex("customers_company_id_client_code_unique_idx").on(
      table.companyId,
      table.clientCode
    ),
  })
);

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  terminalId: uuid("terminal_id")
    .notNull()
    .references(() => terminals.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

  rrn: text("rrn").notNull(),
  actionType: text("action_type").notNull(),
  resultCode: text("result_code").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }),
  balance: decimal("balance", { precision: 10, scale: 2 }),
  errorMessage: text("error_message"),
  requestPayload: text("request_payload"),
  responsePayload: text("response_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ============================================================================
// TRANSACTION LINE ITEMS TABLE
// ============================================================================
export const transactionLineItems = pgTable("transaction_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionLineItemSchema = createInsertSchema(transactionLineItems).omit({
  id: true,
  createdAt: true,
});
export type InsertTransactionLineItem = z.infer<typeof insertTransactionLineItemSchema>;
export type TransactionLineItem = typeof transactionLineItems.$inferSelect;

// ============================================================================
// RELATIONS
// ============================================================================
export const companiesRelations = relations(companies, ({ one, many }) => ({
  branding: one(companyBranding, {
    fields: [companies.id],
    references: [companyBranding.companyId],
  }),
  config: one(companyConfigs, {
    fields: [companies.id],
    references: [companyConfigs.companyId],
  }),
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
// LEGACY TABLE (kept for backward compatibility during migration)
// ============================================================================
export const userConfigs = pgTable(
  "user_configs",
  {
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
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.username], name: "user_configs_project_id_username_pk" }),
  })
);

export const insertUserConfigSchema = createInsertSchema(userConfigs).omit({ updatedAt: true });
export type InsertUserConfig = z.infer<typeof insertUserConfigSchema>;
export type UserConfig = typeof userConfigs.$inferSelect;

// ============================================================================
// AUTH SCHEMAS (Zod)
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
