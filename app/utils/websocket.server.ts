import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';

// Keep track of all active socket connections, grouped by shop ID
const shopConnections: Record<string, Set<WebSocket>> = {};

let wsServer: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server
 * @param httpServer The HTTP server instance
 */
export function initializeWebSocketServer(httpServer: HttpServer) {
    // Create WebSocket server
    wsServer = new WebSocketServer({ server: httpServer });

    wsServer.on('connection', (socket: WebSocket, request: IncomingMessage) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const shopId = url.searchParams.get('shop');

        if (!shopId) {
            console.error('WebSocket connection attempt without shop ID');
            socket.close(1003, 'Shop ID is required');
            return;
        }

        console.log(`WebSocket connected for shop: ${shopId}`);

        // Register this connection for the shop
        if (!shopConnections[shopId]) {
            shopConnections[shopId] = new Set();
        }
        shopConnections[shopId].add(socket);

        // Send initial connection acknowledgment
        socket.send(JSON.stringify({
            type: 'connection',
            message: 'Connected to order updates'
        }));

        // Handle socket closure
        socket.on('close', () => {
            console.log(`WebSocket disconnected for shop: ${shopId}`);
            shopConnections[shopId]?.delete(socket);

            // Clean up empty sets
            if (shopConnections[shopId]?.size === 0) {
                delete shopConnections[shopId];
            }
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`WebSocket error for shop ${shopId}:`, error);
        });
    });

    console.log('WebSocket server initialized');
}

/**
 * Broadcast an update to all connected clients for a specific shop
 * @param shopId The shop ID to broadcast to
 * @param data The data to broadcast
 */
export function broadcastUpdate(shopId: string, data: any) {
    const connections = shopConnections[shopId];
    if (!connections || connections.size === 0) {
        // No active connections for this shop
        return;
    }

    const message = JSON.stringify({
        type: 'update',
        data
    });

    // Send to all connected clients for this shop
    connections.forEach(socket => {
        if (socket.readyState === 1) { // OPEN
            socket.send(message);
        }
    });

    console.log(`Broadcasted update to ${connections.size} clients for shop: ${shopId}`);
}

/**
 * Notify connected clients about a new order
 * @param shopId The shop ID
 * @param orderData The new order data
 */
export function notifyNewOrder(shopId: string, orderData: any) {
    broadcastUpdate(shopId, {
        event: 'new_order',
        order: orderData
    });
} 