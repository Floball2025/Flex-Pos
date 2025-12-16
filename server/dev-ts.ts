import "dotenv/config";
import express from "express";
import cors from "cors";

import { registerRoutes } from "./routes";
import authRoutes from "./auth-routes";
import adminRoutes from "./admin-routes";
import { setupVite } from "./dev-vite";

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

(async () => {
  const server = await registerRoutes(app);
  await setupVite(app, server);

  const port = Number(process.env.PORT || 8080);
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ DEV server listening on port ${port}`);
  });
})();
