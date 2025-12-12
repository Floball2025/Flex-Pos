import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import authRoutes from "./auth-routes";
import adminRoutes from "./admin-routes";
import cors from "cors";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ✅ CORS (necessário para front na Vercel depois)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // depois você adiciona aqui o domínio da Vercel:
      // "https://SEU-FRONT.vercel.app",
      // "https://app.SEUESTABELECIMENTO.com.br",
    ],
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Register auth routes
app.use("/api/auth", authRoutes);

// Register admin routes
app.use("/api/admin", adminRoutes);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  // ✅ Host dinâmico:
  // - No Windows/local: usa 127.0.0.1 (IPv4 e sem ENOTSUP)
  // - Em produção: se HOST não for setado, o provedor já expõe corretamente
  const host = process.env.HOST || "127.0.0.1";

  // ✅ listen simples (SEM reusePort)
  server.listen(port, host, () => {
    log(`serving on port ${host}:${port}`);
  });
})();
