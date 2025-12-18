import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not defined");
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  // 1) Validar input
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { username, password } = parsed.data;

  try {
    // 2) Buscar usuário
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    // 3) Validar existência/ativo
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // 4) Validar hash no banco (evita crash se estiver nulo/errado)
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      console.error("Login error: user has no passwordHash", { userId: user.id });
      return res.status(500).json({ error: "Login failed" });
    }

    // 5) Comparar senha
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // 6) Gerar token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 7) Resposta
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
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
