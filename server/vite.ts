import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import type { Server } from "http";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// ✅ DEV ONLY: importa "vite" e "vite.config" dinamicamente
export async function setupVite(app: Express, server: Server) {
  const viteMod = await import("vite");
  const { default: viteConfig } = await import("../vite.config");

  const viteLogger = viteMod.createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await viteMod.createServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      try {
        (vite as any).ssrFixStacktrace?.(e as Error);
      } catch {}
      next(e);
    }
  });
}

// ✅ PROD: NÃO importa "vite"
export function serveStatic(app: Express) {
  // Quando roda em produção (dist), normalmente existe dist/public ao lado do dist/index.js
  const candidates = [
    path.resolve(__dirname, "public"),              // /workspace/dist/public
    path.resolve(__dirname, "..", "dist", "public") // fallback
  ];

  const distPath = candidates.find((p) => fs.existsSync(p));

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Tried:\n- ${candidates.join("\n- ")}\nMake sure to run: npm run build`
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
