import { WebSocketServer, WebSocket } from "ws";
import { config } from "../config";

let wss: WebSocketServer;

export function startWsServer() {
  wss = new WebSocketServer({ port: config.wsPort });

  wss.on("connection", (ws) => {
    console.log("[WS] Client connected");
    ws.on("close", () => console.log("[WS] Client disconnected"));
  });

  console.log(`[WS] WebSocket server listening on port ${config.wsPort}`);
}

export function broadcast(data: object) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}
