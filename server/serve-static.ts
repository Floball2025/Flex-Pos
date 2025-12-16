import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // 🔥 path absoluto e seguro no Cloud Run
  const distPath = path.resolve(process.cwd(), "dist", "public");

  console.log("📦 Serving static files from:", distPath);

  if (!fs.existsSync(distPath)) {
    console.error("❌ Static build not found:", distPath);
    process.exit(1); // falha explícita e clara
  }

  app.use(express.static(distPath));

  // SPA fallback
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
