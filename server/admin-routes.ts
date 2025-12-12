import express from "express";
import { z } from "zod";
import { authenticateToken, requireAdmin, AuthRequest, hashPassword } from "./auth";
import { db } from "./db";
import { companies, companyBranding, terminals, users, companyConfigs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// GET /api/admin/companies - List all companies
router.get("/companies", async (req: AuthRequest, res) => {
  try {
    const allCompanies = await db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt));

    res.json(allCompanies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// POST /api/admin/companies - Create new company
router.post("/companies", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      businessType: z.string().min(1),
      logoUrl: z.string().optional(),
      primaryColor: z.string().default("#3B82F6"),
      secondaryColor: z.string().default("#1E40AF"),
    });

    const data = schema.parse(req.body);

    // Create company
    const [company] = await db
      .insert(companies)
      .values({
        name: data.name,
        businessType: data.businessType,
      })
      .returning();

    // Create branding
    await db.insert(companyBranding).values({
      companyId: company.id,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
    });

    res.status(201).json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// PATCH /api/admin/companies/:id - Update company
router.patch("/companies/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const schema = z.object({
      name: z.string().min(1).optional(),
      businessType: z.string().min(1).optional(),
    });

    const data = schema.parse(req.body);

    const [company] = await db
      .update(companies)
      .set({
        name: data.name,
        businessType: data.businessType,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();

    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    res.json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error updating company:", error);
    res.status(500).json({ error: "Failed to update company" });
  }
});

// GET /api/admin/companies/:id - Get company details with related data
router.get("/companies/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));

    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    // Get branding
    const [branding] = await db
      .select()
      .from(companyBranding)
      .where(eq(companyBranding.companyId, id));

    // Get terminals
    const companyTerminals = await db
      .select()
      .from(terminals)
      .where(eq(terminals.companyId, id));

    // Get users
    const companyUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.companyId, id));

    // Get config
    const [config] = await db
      .select()
      .from(companyConfigs)
      .where(eq(companyConfigs.companyId, id));

    res.json({
      company,
      branding,
      terminals: companyTerminals,
      users: companyUsers,
      config,
    });
  } catch (error) {
    console.error("Error fetching company details:", error);
    res.status(500).json({ error: "Failed to fetch company details" });
  }
});

// POST /api/admin/companies/:id/terminals - Add terminal to company
router.post("/companies/:id/terminals", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      terminalId: z.string().min(1),
      name: z.string().min(1),
    });

    const data = schema.parse(req.body);

    const [terminal] = await db
      .insert(terminals)
      .values({
        companyId: id,
        terminalId: data.terminalId,
        name: data.name,
        isActive: true,
      })
      .returning();

    res.status(201).json(terminal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error creating terminal:", error);
    res.status(500).json({ error: "Failed to create terminal" });
  }
});

// POST /api/admin/companies/:id/users - Add user to company
router.post("/companies/:id/users", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(6),
      fullName: z.string().min(1),
      role: z.enum(["admin", "user"]).default("user"),
    });

    const data = schema.parse(req.body);

    const passwordHash = await hashPassword(data.password);

    const [user] = await db
      .insert(users)
      .values({
        companyId: id,
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// POST /api/admin/companies/:id/branding - Set company branding (logo)
router.post("/companies/:id/branding", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      logoUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // Check if branding exists
    const [existingBranding] = await db
      .select()
      .from(companyBranding)
      .where(eq(companyBranding.companyId, id));

    let branding;
    if (existingBranding) {
      // Update existing branding - only update provided fields
      const updateData: any = { updatedAt: new Date() };
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
      if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
      if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
      
      [branding] = await db
        .update(companyBranding)
        .set(updateData)
        .where(eq(companyBranding.companyId, id))
        .returning();
    } else {
      // Create new branding
      [branding] = await db
        .insert(companyBranding)
        .values({
          companyId: id,
          logoUrl: data.logoUrl,
          primaryColor: data.primaryColor || "#3B82F6",
          secondaryColor: data.secondaryColor || "#1E40AF",
        })
        .returning();
    }

    res.json(branding);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error setting branding:", error);
    res.status(500).json({ error: "Failed to set branding" });
  }
});

// POST /api/admin/companies/:id/config - Set company config
router.post("/companies/:id/config", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      host: z.string().url(),
      aidPass: z.string().min(1),
      acquirerId: z.string().min(1),
      transactionEndpoint: z.string().min(1),
      tokenEndpoint: z.string().min(1),
      useFixedAmount: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    await db
      .insert(companyConfigs)
      .values({
        companyId: id,
        host: data.host,
        aidPass: data.aidPass,
        acquirerId: data.acquirerId,
        transactionEndpoint: data.transactionEndpoint,
        tokenEndpoint: data.tokenEndpoint,
        useFixedAmount: data.useFixedAmount,
      })
      .onConflictDoUpdate({
        target: companyConfigs.companyId,
        set: {
          host: data.host,
          aidPass: data.aidPass,
          acquirerId: data.acquirerId,
          transactionEndpoint: data.transactionEndpoint,
          tokenEndpoint: data.tokenEndpoint,
          useFixedAmount: data.useFixedAmount,
          updatedAt: new Date(),
        },
      });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error setting company config:", error);
    res.status(500).json({ error: "Failed to set company config" });
  }
});

// DELETE /api/admin/companies/:id - Delete company
router.delete("/companies/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Delete in order: configs, branding, terminals, users, company
    await db.delete(companyConfigs).where(eq(companyConfigs.companyId, id));
    await db.delete(companyBranding).where(eq(companyBranding.companyId, id));
    await db.delete(terminals).where(eq(terminals.companyId, id));
    await db.delete(users).where(eq(users.companyId, id));
    await db.delete(companies).where(eq(companies.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ error: "Failed to delete company" });
  }
});

// PATCH /api/admin/terminals/:id - Update terminal
router.patch("/terminals/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const schema = z.object({
      terminalId: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    const [terminal] = await db
      .update(terminals)
      .set(data)
      .where(eq(terminals.id, id))
      .returning();

    if (!terminal) {
      res.status(404).json({ error: "Terminal not found" });
      return;
    }

    res.json(terminal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Error updating terminal:", error);
    res.status(500).json({ error: "Failed to update terminal" });
  }
});

// DELETE /api/admin/terminals/:id - Delete terminal
router.delete("/terminals/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.delete(terminals).where(eq(terminals.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting terminal:", error);
    res.status(500).json({ error: "Failed to delete terminal" });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete("/users/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
