import express from "express";
import { z } from "zod";
import { login, register, authenticateToken, AuthRequest, hashPassword } from "./auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { loginSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

// POST /api/auth/login - Login with username and password
router.post("/login", async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const result = await login(username, password);

    if (!result) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    res.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register - Register new user (admin only)
router.post("/register", authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only admins can create users
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(6),
      fullName: z.string().min(1),
      companyId: z.string().uuid().nullable(),
      role: z.enum(["admin", "user"]).default("user"),
    });

    const data = schema.parse(req.body);

    const user = await register(
      data.username,
      data.password,
      data.fullName,
      data.companyId,
      data.role
    );

    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// GET /api/auth/me - Get current user info
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    res.json({ user: req.user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// POST /api/auth/change-password - Change password
router.post("/change-password", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    // Get current user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Verify current password
    const bcrypt = await import("bcryptjs");
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, req.user.id));

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.errors });
      return;
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
