import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not defined");
}

// ==========================
// LOGIN
// ==========================
router.post("/login", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string(),
      password: z.string(),
    });

    const { username, password } = schema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // 🔥 AQUI ESTAVA O ERRO
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
