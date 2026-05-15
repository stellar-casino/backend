import express from "express";
import cors from "cors";
import { config } from "./config";
import { router } from "./api/routes";
import { startWsServer } from "./ws/server";
import { startIndexer } from "./indexer/eventIndexer";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(config.port, () => {
  console.log(`[API] HTTP server listening on port ${config.port}`);
});

startWsServer();
startIndexer().catch(console.error);
