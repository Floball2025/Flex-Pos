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
  try {
    console.log("🚀 Starting server...");
    console.log("PORT:", process.env.PORT);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);

    const server = await registerRoutes(app);
    console.log("✅ Routes registered");

    // ✅ Em produção (Cloud Run), nunca subir Vite
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
      console.log("✅ Vite dev middleware enabled");
    } else {
      serveStatic(app);
      console.log("✅ Serving static files");
    }

    const port = Number(process.env.PORT || 8080);

    server.listen(port, () => {
      console.log(`✅ Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("🔥 FATAL STARTUP ERROR");
    console.error(err);
    process.exit(1);
  }
})();
