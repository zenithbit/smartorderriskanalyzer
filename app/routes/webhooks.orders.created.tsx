import type { ActionFunctionArgs } from "@remix-run/node";
import crypto from "crypto";

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

        console.log(`Received ${topic} webhook from ${shop}`);

        // Here you would implement the order risk analysis logic
        // For example:
        // 1. Calculate risk score based on order data
        // 2. Store the order data and risk score in the database
        // 3. Trigger notifications if risk score is above a threshold

        // For demonstration purposes, log some basic order information
        if (payload) {
            console.log(`Order #${payload.name || payload.id} received`);
            if (payload.customer) {
                console.log(`Customer: ${payload.customer.first_name} ${payload.customer.last_name}`);
            }
            console.log(`Total: ${payload.total_price} ${payload.currency}`);
        }
    } catch (error) {
        console.error("Error processing webhook payload:", error);
    }
} 