import { ObjectId } from 'mongodb';
import { getCollection } from '../utils/db.server';

export type Order = {
    _id?: ObjectId;
    shopId: string;
    orderId: string;
    orderNumber: string;
    date: Date;
    customer: {
        id?: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        totalOrders?: number;
        totalSpent?: number;
    };
    financialStatus: string;
    fulfillmentStatus: string;
    totalPrice: number;
    currency: string;
    items: Array<{
        id: string;
        title: string;
        quantity: number;
        price: number;
        sku?: string;
    }>;
    shippingAddress?: {
        address1: string;
        address2?: string;
        city: string;
        province?: string;
        zip: string;
        country: string;
    };
    billingAddress?: {
        address1: string;
        address2?: string;
        city: string;
        province?: string;
        zip: string;
        country: string;
    };
    riskAnalysis: {
        score: number;
        level: 'low' | 'medium' | 'high';
        factors: string[];
        ipAddress?: string;
        checkoutSpeed?: number;
        reviewed: boolean;
        status: 'approved' | 'pending' | 'declined' | 'on_hold';
        aiFeedback?: {
            originalScore: number;
            userFeedback: 'correct' | 'incorrect';
            userAssignedLevel?: 'low' | 'medium' | 'high';
            feedbackDate?: Date;
        };
    };
    createdAt: Date;
    updatedAt: Date;
};

export type OrderSummary = {
    _id?: ObjectId;
    shopId: string;
    period: string; // 'daily', 'weekly', 'monthly'
    date: Date;
    totalOrders: number;
    totalAmount: number;
    currency: string;
    riskBreakdown: {
        low: number;
        medium: number;
        high: number;
    };
    regionData?: Array<{
        region: string;
        orders: number;
        riskPercentage: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
};

// Order operations
export async function getOrderById(shopId: string, orderId: string) {
    const collection = await getCollection('orders');
    return await collection.findOne({ shopId, orderId }) as Order | null;
}

export async function createOrder(order: Omit<Order, '_id'>) {
    const collection = await getCollection('orders');
    const result = await collection.insertOne({
        ...order,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return result.insertedId;
}

export async function updateOrder(shopId: string, orderId: string, updates: Partial<Order>) {
    const collection = await getCollection('orders');
    const result = await collection.updateOne(
        { shopId, orderId },
        {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        }
    );
    return result.modifiedCount > 0;
}

export async function getOrdersByRiskLevel(shopId: string, riskLevel: 'low' | 'medium' | 'high', limit = 20, skip = 0) {
    const collection = await getCollection('orders');
    return await collection
        .find({ shopId, 'riskAnalysis.level': riskLevel })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Order[];
}

export async function getOrdersByStatus(shopId: string, status: 'approved' | 'pending' | 'declined' | 'on_hold', limit = 20, skip = 0) {
    const collection = await getCollection('orders');
    return await collection
        .find({ shopId, 'riskAnalysis.status': status })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Order[];
}

export async function getRecentOrders(shopId: string, limit = 20, skip = 0) {
    const collection = await getCollection('orders');
    return await collection
        .find({ shopId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Order[];
}

// Order summary operations
export async function createOrUpdateSummary(summary: Omit<OrderSummary, '_id'>) {
    const collection = await getCollection('orderSummaries');

    // Try to find existing summary for this period
    const existingSummary = await collection.findOne({
        shopId: summary.shopId,
        period: summary.period,
        date: summary.date
    });

    if (existingSummary) {
        // Update existing summary
        await collection.updateOne(
            { _id: existingSummary._id },
            {
                $set: {
                    ...summary,
                    updatedAt: new Date()
                }
            }
        );
        return existingSummary._id;
    } else {
        // Create new summary
        const result = await collection.insertOne({
            ...summary,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return result.insertedId;
    }
}

export async function getMonthlySummary(shopId: string, date: Date) {
    const collection = await getCollection('orderSummaries');
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return await collection.findOne({
        shopId,
        period: 'monthly',
        date: {
            $gte: startOfMonth,
            $lte: endOfMonth
        }
    }) as OrderSummary | null;
}

export async function getRegionalRiskData(shopId: string, date: Date) {
    const summary = await getMonthlySummary(shopId, date);
    return summary?.regionData || [];
} 