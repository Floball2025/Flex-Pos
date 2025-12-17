import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export type JwtUser = {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "user";
  companyId: string | null;
};

export type AuthRequest = Request & { user?: JwtUser };

// ✅ LOGIN (retorna exatamente o que o front espera)
export async function login(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));

  if (!user) return null;
  if (!user.isActive) return null;

  // ✅ Drizzle retorna camelCase -> user.passwordHash
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as "admin" | "user",
      companyId: user.companyId ?? null,
    } satisfies JwtUser,
  };
}

// ✅ REGISTER (para o endpoint /register funcionar)
export async function register(
  username: string,
  password: string,
  fullName: string,
  companyId: string | null,
  role: "admin" | "user" = "user"
) {
  const passwordHash = await hashPassword(password);

  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      fullName,
      companyId,
      role,
      isActive: true,
    })
    .returning();

  return created;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// ✅ MIDDLEWARE: valida JWT e popula req.user (com await)
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: "admin" | "user";
    };

    const [u] = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!u || !u.isActive) return res.status(401).json({ error: "Not authenticated" });

    req.user = {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role as "admin" | "user",
      companyId: u.companyId ?? null,
    };

    return next();
  } catch (e) {
    console.error("Auth error:", e);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ✅ MIDDLEWARE: exige admin
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  return next();
}
