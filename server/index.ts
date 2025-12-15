import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";

import { registerRoutes } from "./routes";
import authRoutes from "./auth-routes";
import adminRoutes from "./admin-routes";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  cors({
    origin: [
      "http://localhost:5173",
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

// logger simples (não depende de Vite)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  const originalJson = res.json.bind(res);
  let capturedJsonResponse: Record<string, any> | undefined;

  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (line.length > 180) line = line.slice(0, 179) + "…";
      console.log(line);
    }
  });

  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

(async () => {
  try {
    console.log("🚀 Starting server...");
    console.log("PORT:", process.env.PORT);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);

    const server = await registerRoutes(app);
    console.log("✅ Routes registered");

    // ✅ DEV: usa Vite (import dinâmico)
    if (process.env.NODE_ENV === "development") {
      const { setupVite } = await import("./dev-vite");
      await setupVite(app, server);
      console.log("✅ Vite dev middleware enabled");
    } else {
      // ✅ PROD: serve somente arquivos estáticos já buildados
      const { serveStatic } = await import("./serve-static");
      serveStatic(app);
      console.log("✅ Serving static files");
    }

    const port = Number(process.env.PORT || 8080);
    server.listen(port, "0.0.0.0", () => {
      console.log(`✅ Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("🔥 FATAL STARTUP ERROR");
    console.error(err);
    process.exit(1);
  }
})();
