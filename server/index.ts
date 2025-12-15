import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
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

// Logger simples (não depende do ./vite)
function logLine(msg: string) {
  console.log(msg);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (line.length > 180) line = line.slice(0, 179) + "…";
      logLine(line);
    }
  });

  next();
});

// Register auth routes
app.use("/api/auth", authRoutes);

// Register admin routes
app.use("/api/admin", adminRoutes);

(async () => {
  try {
    console.log("🚀 Starting server...");
    console.log("PORT:", process.env.PORT);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);

    const server = await registerRoutes(app);
    console.log("✅ Routes registered");

    // ✅ Vite só em DEV (import dinâmico para não quebrar produção)
    if (process.env.NODE_ENV === "development") {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
      console.log("✅ Vite dev middleware enabled");
    } else {
      const { serveStatic } = await import("./vite");
      serveStatic(app);
      console.log("✅ Serving static files");
    }

    const port = Number(process.env.PORT || 8080);

    // Cloud Run: não precisa host explícito (mas pode colocar "0.0.0.0" se quiser)
    server.listen(port, () => {
      console.log(`✅ Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("🔥 FATAL STARTUP ERROR");
    console.error(err);
    process.exit(1);
  }
})();
