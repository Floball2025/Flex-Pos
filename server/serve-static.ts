import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  const distPath = path.resolve("dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(`dist/public não encontrado. Rode npm run build`);
  }

  app.use(express.static(distPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
