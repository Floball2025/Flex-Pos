import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function login(username: string, password: string) {
  // busca usuário
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (!user) return null;
  if (!user.isActive) return null; // 🔥 camelCase

  // 🔥 CORREÇÃO DEFINITIVA
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return {
  token,
  user: {
    id: user.id,
    username: user.username,
    fullName: user.fullName,      // ✅ ADICIONADO
    role: user.role,
    companyId: user.companyId,    // ✅ ADICIONADO
  },
};


}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
