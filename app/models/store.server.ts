import { getCollection } from '../utils/db.server';

export type StoreSettings = {
    shopId: string;
    riskThresholds: {
        high: number;
        medium: number;
    };
    riskFactors: {
        orderValue: boolean;
        customerHistory: boolean;
        ipLocation: boolean;
        checkoutSpeed: boolean;
        addressMismatch: boolean;
        emailDomain: boolean;
        orderTime: boolean;
        giftCardUse: boolean;
        quantitySpike: boolean;
    };
    notifications: {
        email: {
            enabled: boolean;
            address: string;
        };
        slack: {
            enabled: boolean;
            webhookUrl: string;
        };
        frequency: 'immediate' | 'hourly' | 'daily';
    };
    automations: {
        holdHighRiskOrders: boolean;
        emailVerification: boolean;
        cancelHighRiskOrders: boolean;
        customEmail: boolean;
        flagForReview: boolean;
        customEmailTemplate?: string;
    };
    aiSettings: {
        enableFeedback: boolean;
        dataSharing: 'none' | 'anonymized' | 'full';
    };
    createdAt: Date;
    updatedAt: Date;
};

export type TrialStatus = {
    shopId: string;
    isActive: boolean;
    startedAt: Date | null;
    daysRemaining: number;
    plan: 'free' | 'pro' | 'business';
    createdAt: Date;
    updatedAt: Date;
};

// Store settings operations
export async function getStoreSettings(shopId: string) {
    const collection = await getCollection('storeSettings');
    const settings = await collection.findOne({ shopId });
    return settings as StoreSettings | null;
}

export async function createDefaultStoreSettings(shopId: string) {
    const collection = await getCollection('storeSettings');

    const defaultSettings: Omit<StoreSettings, '_id'> = {
        shopId,
        riskThresholds: {
            high: 75,
            medium: 50
        },
        riskFactors: {
            orderValue: true,
            customerHistory: true,
            ipLocation: true,
            checkoutSpeed: true,
            addressMismatch: true,
            emailDomain: true,
            orderTime: true,
            giftCardUse: true,
            quantitySpike: true
        },
        notifications: {
            email: {
                enabled: true,
                address: ''
            },
            slack: {
                enabled: false,
                webhookUrl: ''
            },
            frequency: 'immediate'
        },
        automations: {
            holdHighRiskOrders: true,
            emailVerification: false,
            cancelHighRiskOrders: false,
            customEmail: false,
            flagForReview: true
        },
        aiSettings: {
            enableFeedback: true,
            dataSharing: 'anonymized'
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(defaultSettings);
    return { ...defaultSettings, _id: result.insertedId };
}

export async function updateStoreSettings(shopId: string, settings: Partial<StoreSettings>) {
    const collection = await getCollection('storeSettings');

    const updatedSettings = {
        ...settings,
        updatedAt: new Date()
    };

    const result = await collection.updateOne(
        { shopId },
        { $set: updatedSettings }
    );

    if (result.matchedCount === 0) {
        // No document matched, create default and then update
        await createDefaultStoreSettings(shopId);
        await collection.updateOne(
            { shopId },
            { $set: updatedSettings }
        );
    }

    return await getStoreSettings(shopId);
}

// Trial status operations
export async function getTrialStatus(shopId: string) {
    const collection = await getCollection('trialStatus');
    const status = await collection.findOne({ shopId });
    return status as TrialStatus | null;
}

export async function createDefaultTrialStatus(shopId: string) {
    const collection = await getCollection('trialStatus');

    const defaultTrialStatus: Omit<TrialStatus, '_id'> = {
        shopId,
        isActive: false,
        startedAt: null,
        daysRemaining: 14,
        plan: 'free',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(defaultTrialStatus);
    return { ...defaultTrialStatus, _id: result.insertedId };
}

export async function startTrial(shopId: string) {
    const collection = await getCollection('trialStatus');

    const currentDate = new Date();

    const updatedTrialStatus = {
        isActive: true,
        startedAt: currentDate,
        daysRemaining: 14,
        plan: 'pro',
        updatedAt: currentDate
    };

    const result = await collection.updateOne(
        { shopId },
        { $set: updatedTrialStatus }
    );

    if (result.matchedCount === 0) {
        // No document matched, create default and then update
        await createDefaultTrialStatus(shopId);
        await collection.updateOne(
            { shopId },
            { $set: updatedTrialStatus }
        );
    }

    return await getTrialStatus(shopId);
}

export async function updateTrialStatus(shopId: string, status: Partial<TrialStatus>) {
    const collection = await getCollection('trialStatus');

    const updatedStatus = {
        ...status,
        updatedAt: new Date()
    };

    const result = await collection.updateOne(
        { shopId },
        { $set: updatedStatus }
    );

    if (result.matchedCount === 0) {
        // No document matched, create default and then update
        await createDefaultTrialStatus(shopId);
        await collection.updateOne(
            { shopId },
            { $set: updatedStatus }
        );
    }

    return await getTrialStatus(shopId);
} 