import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

import crypto from "crypto";

// JWT_SECRET - use env var or generate a random one for development
// In production, JWT_SECRET MUST be set as a Replit Secret
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const secret = crypto.randomBytes(32).toString("base64");
  console.warn("⚠️  WARNING: Using randomly generated JWT_SECRET. Set JWT_SECRET in Replit Secrets for production!");
  return secret;
})();

const JWT_EXPIRES_IN = "7d";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "user";
  companyId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null && 'id' in decoded) {
      return decoded as AuthUser;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate requests
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Verify user still exists and is active
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, decoded.id), eq(users.isActive, true)));

    if (!user) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as "admin" | "user",
      companyId: user.companyId,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Middleware to require admin role
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

// Middleware to require specific company access
export function requireCompanyAccess(companyIdParam: string = "companyId") {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const requestedCompanyId = req.params[companyIdParam] || req.body.companyId;

    // Admin can access all companies
    if (req.user.role === "admin") {
      next();
      return;
    }

    // Regular users can only access their own company
    if (req.user.companyId !== requestedCompanyId) {
      res.status(403).json({ error: "Access denied to this company" });
      return;
    }

    next();
  };
}

// Login function - accepts username
export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
  // Find user by username
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (!user) {
    return null;
  }

  // Check if user is active
  if (!user.isActive) {
    return null;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Create auth user object
  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as "admin" | "user",
    companyId: user.companyId,
  };

  // Generate token
  const token = generateToken(authUser);

  return { token, user: authUser };
}

// Register function (admin only - creates users for companies)
export async function register(
  username: string,
  password: string,
  fullName: string,
  companyId: string | null,
  role: "admin" | "user" = "user"
): Promise<AuthUser> {
  const passwordHash = await hashPassword(password);

  const [newUser] = await db
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

  return {
    id: newUser.id,
    username: newUser.username,
    fullName: newUser.fullName,
    role: newUser.role as "admin" | "user",
    companyId: newUser.companyId,
  };
}
