import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET not defined");

router.post("/login", async (req, res) => {
  try {
    const bodySchema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    });

    const { username, password } = bodySchema.parse(req.body);

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const user = rows[0];

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // 🔎 DEBUG (vai aparecer no Cloud Run Logs)
    console.log("Login user found:", {
      id: user.id,
      username: user.username,
      isActive: user.isActive,
      hasPasswordHash: Boolean((user as any).passwordHash),
      hasPassword_Hash: Boolean((user as any).password_Hash),
      hasPassword_hash: Boolean((user as any).password_hash),
    });

    // ✅ pega o hash correto mesmo se o schema estiver desalinhado
    const hash =
      (user as any).passwordHash ??
      (user as any).password_Hash ??
      (user as any).password_hash;

    if (!hash) {
      console.error("Password hash missing from DB result. Check Drizzle schema mapping.");
      return res.status(500).json({ error: "Server misconfigured (password hash mapping)" });
    }

    const ok = await bcrypt.compare(password, hash);

    if (!ok) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, companyId: user.companyId ?? null },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (err) {
    console.error("Login error (full):", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
