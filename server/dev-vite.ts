import type { Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../vite.config";

export async function setupVite(app: Express) {
  const vite = await createViteServer({
    ...viteConfig,
    server: { middlewareMode: true },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const indexHtml = fs.readFileSync(
        path.resolve("client/index.html"),
        "utf-8"
      );
      const html = await vite.transformIndexHtml(req.originalUrl, indexHtml);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      next(e);
    }
  });
}
