import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import dotenv from "dotenv";
import { upsertShopifyStore } from "./models/shopifyStore.server";

// Load environment variables
dotenv.config();

// Get MongoDB connection information
const mongoUrl = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB_NAME || "shopify_app";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new MongoDBSessionStorage(
    new URL(mongoUrl),
    dbName,
  ),
  distribution: AppDistribution.AppStore,
  webhooks: {
    // Configure webhooks to listen to specific topics
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app/uninstalled",
    },
    APP_SUBSCRIPTIONS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app/scopes_update",
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/created",
    },
  },
  hooks: {
    // Register webhooks after a merchant installs the app
    afterAuth: async ({ session }) => {
      // This is called after a merchant installs or updates the app's permissions
      console.log("Registering webhooks for shop:", session.shop);
      try {
        const webhookResult = await shopify.registerWebhooks({ session });
        console.log("Webhook registration result:", JSON.stringify(webhookResult));
        console.log("Successfully registered webhooks");

        // Store shop information in our database
        await upsertShopifyStore({
          shopDomain: session.shop,
          accessToken: session.accessToken,
          scope: session.scope || '',
        });
        console.log("Successfully stored shop data");
      } catch (error) {
        console.error("Error in afterAuth:", error);
      }
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
