import type { ActionFunctionArgs } from "@remix-run/node";
import crypto from "crypto";
import { analyzeOrderRisk, mapShopifyOrderToModel } from "../utils/riskAnalysis.server";
import { createOrder, getOrderById } from "../models/order.server";
import { sendRiskNotifications } from "../utils/notifications.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        // Clone the request to get raw payload for manual verification
        const reqClone = request.clone();
        const rawPayload = await reqClone.text();

        // First return a 200 OK response immediately to acknowledge receipt
        // This ensures Shopify knows we received the webhook
        const response = new Response(null, { status: 200 });

        // Now process the webhook asynchronously (won't block the 200 response)
        processWebhook(request, rawPayload).catch(error => {
            console.error("Error processing webhook:", error);
        });

        return response;
    } catch (error) {
        console.error("Error in webhook handler:", error);
        // Still return 200 OK to prevent Shopify from retrying
        return new Response(null, { status: 200 });
    }
};

// Process the webhook asynchronously
async function processWebhook(request: Request, rawPayload: string) {
    // Validate HMAC signature
    const signature = request.headers.get("x-shopify-hmac-sha256");
    if (signature) {
        const secretKey = process.env.SHOPIFY_API_SECRET || "";
        const generatedSignature = crypto
            .createHmac("SHA256", secretKey)
            .update(rawPayload)
            .digest("base64");

        if (signature !== generatedSignature) {
            console.error("Invalid webhook signature");
            return;
        }
    }

    try {
        // Parse the payload manually since we've already consumed the request body
        const payload = JSON.parse(rawPayload);
        const shop = request.headers.get("x-shopify-shop-domain");
        const topic = request.headers.get("x-shopify-topic");

        if (!shop) {
            console.error("Missing shop domain in webhook headers");
            return;
        }

        console.log(`Received ${topic} webhook from ${shop}`);
        console.log(`Order #${payload.name || payload.id} received`);

        // Analyze order risk based on the plan
        console.log("Analyzing order risk for shop:", shop);
        const shopId = shop; // Use shop domain as shopId

        // Analyze the order risk
        const riskAnalysis = await analyzeOrderRisk(payload, shopId);
        console.log("Risk analysis result:", JSON.stringify(riskAnalysis));

        // Map Shopify order to our data model
        const orderData = mapShopifyOrderToModel(payload, shopId, riskAnalysis);

        // Save order data to database
        const orderId = await createOrder(orderData);
        console.log(`Order saved to database with _id: ${orderId}`);

        // Output a summary of the analysis
        console.log(`
          Order Analysis Summary:
          - Order: ${payload.name || payload.id}
          - Risk Score: ${riskAnalysis.score}
          - Risk Level: ${riskAnalysis.level}
          - Status: ${riskAnalysis.status}
          - Risk Factors: ${riskAnalysis.factors.join(', ')}
        `);

        // Send notifications based on risk level and store settings
        // Get the full order with the MongoDB ID
        const savedOrder = await getOrderById(shopId, payload.id.toString());
        if (savedOrder) {
            await sendRiskNotifications(savedOrder, shopId);
        } else {
            console.error("Could not find saved order for notifications");
        }

    } catch (error) {
        console.error("Error processing webhook payload:", error);
    }
} 