import "dotenv/config";
import express from "express";
import cors from "cors";

import { registerRoutes } from "./routes";
import authRoutes from "./auth-routes";
import adminRoutes from "./admin-routes";
import { serveStatic } from "./serve-static";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

async function bootstrap() {
  console.log("🚀 Starting server");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PORT:", process.env.PORT);

  const server = await registerRoutes(app);

  // 🚫 NUNCA importar Vite aqui
  serveStatic(app);

  const port = Number(process.env.PORT || 8080);
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server listening on port ${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("🔥 Fatal error", err);
  process.exit(1);
});
