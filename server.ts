import express from "express";
import { createServer } from "http";
import { initializeWebSocketServer } from "./app/utils/websocket.server.js";
import "dotenv/config";

// Create Express app and HTTP server (for WebSockets only)
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server with HTTP server
initializeWebSocketServer(httpServer);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("WebSocket server is running");
});

// Support for Cloudflare - handle WebSocket upgrade on the /ws path
app.get("/ws", (req, res) => {
    res.status(426).send("Upgrade Required"); // WebSocket protocol upgrade required
});

// Default port or use environment variable
const port = process.env.WS_PORT || 3001;

// Start the server
httpServer.listen(port, () => {
    console.log(`WebSocket server listening on port ${port}`);
    console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);
}); 