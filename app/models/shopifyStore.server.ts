import { getCollection } from '../utils/db.server';
import { ObjectId } from 'mongodb';

export interface ShopifyStore {
    _id?: ObjectId | string;
    shopDomain: string;
    accessToken: string;
    createdAt: Date;
    lastAccess: Date;
    updatedAt: Date;
    scope: string;
    metadata?: Record<string, any>;
    uninstalledAt?: Date | null;
    scheduledCleanupDataAfter24Hours?: boolean;
    lastUninstallDate?: Date | null;
    reInstalledAt?: Date | null;
}

/**
 * Get store data by shop domain
 */
export async function getShopifyStoreByDomain(shopDomain: string): Promise<ShopifyStore | null> {
    const collection = await getCollection('store');
    return await collection.findOne({ shopDomain }) as ShopifyStore | null;
}

/**
 * Create or update a Shopify store record
 */
export async function upsertShopifyStore(storeData: Partial<ShopifyStore>): Promise<ShopifyStore> {
    const collection = await getCollection('store');

    const shopDomain = storeData.shopDomain;
    if (!shopDomain) {
        throw new Error('Shop domain is required');
    }

    const now = new Date();

    // Check if store exists
    const existingStore = await collection.findOne({ shopDomain });

    if (existingStore) {
        // Update existing store
        const updatedStore = {
            ...storeData,
            lastAccess: now,
            updatedAt: now
        };

        await collection.updateOne(
            { shopDomain },
            { $set: updatedStore }
        );

        return {
            ...existingStore,
            ...updatedStore
        } as ShopifyStore;
    } else {
        // Create new store
        const newStore: ShopifyStore = {
            shopDomain,
            accessToken: storeData.accessToken || '',
            createdAt: now,
            lastAccess: now,
            updatedAt: now,
            scope: storeData.scope || '',
            metadata: storeData.metadata || {},
            uninstalledAt: null,
            scheduledCleanupDataAfter24Hours: storeData.scheduledCleanupDataAfter24Hours || false,
            lastUninstallDate: null,
            reInstalledAt: null
        };

        const result = await collection.insertOne(newStore);
        return { ...newStore, _id: result.insertedId } as ShopifyStore;
    }
}

/**
 * Update store when it's uninstalled
 */
export async function markStoreAsUninstalled(shopDomain: string): Promise<void> {
    const collection = await getCollection('store');
    const now = new Date();

    await collection.updateOne(
        { shopDomain },
        {
            $set: {
                uninstalledAt: now,
                lastUninstallDate: now,
                updatedAt: now
            }
        }
    );
}

/**
 * Update store when it's reinstalled
 */
export async function markStoreAsReinstalled(shopDomain: string): Promise<void> {
    const collection = await getCollection('store');
    const now = new Date();

    await collection.updateOne(
        { shopDomain },
        {
            $set: {
                uninstalledAt: null,
                reInstalledAt: now,
                updatedAt: now
            }
        }
    );
}

/**
 * Delete a store record
 */
export async function deleteShopifyStore(shopDomain: string): Promise<boolean> {
    const collection = await getCollection('store');
    const result = await collection.deleteOne({ shopDomain });
    return result.deletedCount === 1;
} 