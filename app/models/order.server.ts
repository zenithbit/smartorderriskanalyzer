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

/**
 * Gets dashboard statistics for orders
 * @param shopId The shop ID
 * @returns Statistics for the dashboard
 */
export async function getDashboardStats(shopId: string) {
    const collection = await getCollection('orders');

    // Get current date and 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count total orders
    const totalOrders = await collection.countDocuments({
        shopId,
        date: { $gte: thirtyDaysAgo }
    });

    // Count risky orders (medium and high)
    const riskyOrders = await collection.countDocuments({
        shopId,
        date: { $gte: thirtyDaysAgo },
        $or: [
            { 'riskAnalysis.level': 'medium' },
            { 'riskAnalysis.level': 'high' }
        ]
    });

    // Get average risk score
    const aggregateResult = await collection.aggregate([
        {
            $match: {
                shopId,
                date: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: null,
                averageScore: { $avg: '$riskAnalysis.score' }
            }
        }
    ]).toArray();

    const averageRiskScore = aggregateResult.length > 0
        ? Math.round(aggregateResult[0].averageScore)
        : 0;

    // Calculate risk percentage
    const riskPercentage = totalOrders > 0
        ? parseFloat(((riskyOrders / totalOrders) * 100).toFixed(1))
        : 0;

    return {
        totalOrders,
        riskyOrders,
        riskPercentage,
        averageRiskScore
    };
}

/**
 * Gets risk data by region
 * @param shopId The shop ID
 * @returns Risk data by region
 */
export async function getRiskByRegion(shopId: string): Promise<Array<{
    region: string;
    orders: number;
    riskPercentage: number;
}>> {
    const collection = await getCollection('orders');

    // Get current date and 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // If we had proper region data in the orders, we'd use aggregation
    // For now, let's create some simulated regional data based on real orders

    // Get total orders in last 30 days
    const totalOrders = await collection.countDocuments({
        shopId,
        date: { $gte: thirtyDaysAgo }
    });

    if (totalOrders === 0) {
        return [];
    }

    // Get counts by risk level
    // Define type for the result of the aggregate operation
    type RiskLevelCount = { _id: string; count: number };

    const riskLevelCounts = await collection.aggregate([
        {
            $match: {
                shopId,
                date: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: '$riskAnalysis.level',
                count: { $sum: 1 }
            }
        }
    ]).toArray() as RiskLevelCount[];

    // Create region data (this would normally come from order shipping addresses)
    // For now, we'll just distribute the real risk counts among regions
    const regions = ["North America", "Europe", "Asia", "Other"];
    const distribution = [0.5, 0.3, 0.15, 0.05]; // Distribution of orders among regions

    const highRiskCount = riskLevelCounts.find((r: RiskLevelCount) => r._id === 'high')?.count || 0;
    const mediumRiskCount = riskLevelCounts.find((r: RiskLevelCount) => r._id === 'medium')?.count || 0;
    const totalRiskCount = highRiskCount + mediumRiskCount;

    return regions.map((region, index) => {
        const regionOrderCount = Math.round(totalOrders * distribution[index]);
        // Higher risk percentage for smaller regions
        const riskPercentage = Math.min(
            Math.round((totalRiskCount * (1 + index * 0.3) * distribution[index]) / regionOrderCount * 100),
            100
        );

        return {
            region,
            orders: regionOrderCount,
            riskPercentage
        };
    });
}

/**
 * Gets orders for the dashboard with appropriate formatting
 * @param shopId The shop ID
 * @param limit Maximum number of orders to return
 * @param skip Number of orders to skip for pagination
 * @returns Formatted orders for the dashboard
 */
export async function getDashboardOrders(shopId: string, limit = 10, skip = 0): Promise<Array<{
    id: string;
    date: string;
    customer: string;
    total: string;
    riskScore: number;
    riskReasons: string;
    status: string;
}>> {
    const orders = await getRecentOrders(shopId, limit, skip);

    return orders.map(order => ({
        id: `#${order.orderNumber}`,
        date: order.date.toISOString().split('T')[0],
        customer: `${order.customer.firstName} ${order.customer.lastName}`,
        total: `$${order.totalPrice.toFixed(2)}`,
        riskScore: order.riskAnalysis.score,
        riskReasons: order.riskAnalysis.factors.join(', '),
        status: order.riskAnalysis.status === 'on_hold' ? 'On Hold' :
            order.riskAnalysis.status === 'pending' ? 'Pending Review' :
                order.riskAnalysis.status === 'declined' ? 'Declined' : 'Approved'
    }));
} 