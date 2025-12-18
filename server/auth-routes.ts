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

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = loginBodySchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Drizzle: coluna password_hash → propriedade TS passwordHash
    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
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
  } catch (error) {
    console.error("Login error:", error);
    // 400 se body inválido, 500 se erro interno
    return res.status(400).json({ error: "Login failed" });
  }
});

export default router;
