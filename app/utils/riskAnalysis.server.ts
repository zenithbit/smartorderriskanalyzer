import { getStoreSettings, getTrialStatus } from "../models/store.server";

type RiskFactorResult = {
    factor: string;
    description: string;
    riskContribution: number;
};

/**
 * Analyzes an order for risk factors
 * @param order The Shopify order object
 * @param shopId The shop ID
 * @param storeSettings The store settings containing risk thresholds and factors
 * @returns Risk analysis results
 */
export async function analyzeOrderRisk(order: any, shopId: string) {
    // Get store settings and trial status
    const storeSettings = await getStoreSettings(shopId);
    const trialStatus = await getTrialStatus(shopId);

    // If settings don't exist, use default risk thresholds
    const riskThresholds = storeSettings?.riskThresholds || { high: 75, medium: 50 };
    const enabledFactors = storeSettings?.riskFactors || {
        orderValue: true,
        customerHistory: true,
        ipLocation: true,
        checkoutSpeed: true,
        addressMismatch: true,
        emailDomain: true,
        orderTime: true,
        giftCardUse: true,
        quantitySpike: true
    };

    // Determine which factors to check based on plan
    const isPro = trialStatus?.isActive || trialStatus?.plan === 'pro' || trialStatus?.plan === 'business';

    // Free plan only gets basic risk factors
    const factorsToCheck = isPro ?
        enabledFactors :
        {
            orderValue: true,
            addressMismatch: true,
            emailDomain: true,
            orderTime: false,
            customerHistory: false,
            ipLocation: false,
            checkoutSpeed: false,
            giftCardUse: false,
            quantitySpike: false
        };

    // Array to collect risk factors
    const riskFactors: RiskFactorResult[] = [];
    let totalRiskScore = 0;

    // Check order value (available to all plans)
    if (factorsToCheck.orderValue) {
        const totalPrice = parseFloat(order.total_price);

        // Higher value orders have higher risk
        if (totalPrice > 1000) {
            riskFactors.push({
                factor: "orderValue",
                description: "High value order",
                riskContribution: 20
            });
            totalRiskScore += 20;
        } else if (totalPrice > 500) {
            riskFactors.push({
                factor: "orderValue",
                description: "Medium-high value order",
                riskContribution: 10
            });
            totalRiskScore += 10;
        }
    }

    // Check address mismatch (available to all plans)
    if (factorsToCheck.addressMismatch && order.billing_address && order.shipping_address) {
        const billing = order.billing_address;
        const shipping = order.shipping_address;

        if (
            billing.zip !== shipping.zip ||
            billing.city !== shipping.city ||
            billing.country !== shipping.country
        ) {
            riskFactors.push({
                factor: "addressMismatch",
                description: "Billing and shipping addresses don't match",
                riskContribution: 15
            });
            totalRiskScore += 15;
        }
    }

    // Check suspicious email domains (available to all plans)
    if (factorsToCheck.emailDomain && order.customer && order.customer.email) {
        const email = order.customer.email.toLowerCase();
        const suspiciousDomains = [
            'tempmail.com', 'throwawaymail.com', 'mailinator.com',
            'guerrillamail.com', 'yopmail.com', 'sharklasers.com'
        ];

        const domain = email.split('@')[1];
        if (domain && suspiciousDomains.includes(domain)) {
            riskFactors.push({
                factor: "emailDomain",
                description: "Suspicious email domain",
                riskContribution: 25
            });
            totalRiskScore += 25;
        }
    }

    // Pro plan features
    if (isPro) {
        // Check IP location (pro plan only)
        if (factorsToCheck.ipLocation && order.browser_ip) {
            // In a real implementation, this would use a geolocation service
            // For now, we'll just flag non-empty IPs with a small risk
            riskFactors.push({
                factor: "ipLocation",
                description: "IP address tracking enabled",
                riskContribution: 5
            });
            totalRiskScore += 5;
        }

        // Check order time (pro plan only)
        if (factorsToCheck.orderTime && order.created_at) {
            const orderDate = new Date(order.created_at);
            const hourOfDay = orderDate.getHours();

            // Orders placed late at night might be higher risk
            if (hourOfDay >= 22 || hourOfDay <= 4) {
                riskFactors.push({
                    factor: "orderTime",
                    description: "Order placed during unusual hours",
                    riskContribution: 10
                });
                totalRiskScore += 10;
            }
        }

        // Check gift card usage (pro plan only)
        if (factorsToCheck.giftCardUse && order.payment_gateway_names) {
            if (order.payment_gateway_names.some((method: string) => method.toLowerCase().includes('gift'))) {
                riskFactors.push({
                    factor: "giftCardUse",
                    description: "Payment with gift card",
                    riskContribution: 15
                });
                totalRiskScore += 15;
            }
        }
    }

    // Calculate final risk level based on score
    let riskLevel: 'low' | 'medium' | 'high';
    if (totalRiskScore >= riskThresholds.high) {
        riskLevel = 'high';
    } else if (totalRiskScore >= riskThresholds.medium) {
        riskLevel = 'medium';
    } else {
        riskLevel = 'low';
    }

    // Determine status based on risk level and store settings
    let status: 'approved' | 'pending' | 'declined' | 'on_hold';
    if (riskLevel === 'high' && storeSettings?.automations?.holdHighRiskOrders) {
        status = 'on_hold';
    } else if (riskLevel === 'high' && storeSettings?.automations?.flagForReview) {
        status = 'pending';
    } else if (riskLevel === 'high' && storeSettings?.automations?.cancelHighRiskOrders) {
        status = 'declined';
    } else {
        status = 'approved';
    }

    // Return the risk analysis results
    return {
        score: totalRiskScore,
        level: riskLevel,
        factors: riskFactors.map(f => f.description),
        reviewed: false,
        status,
        ipAddress: order.browser_ip || order.client_details?.browser_ip,
        checkoutSpeed: undefined // Would need to compare checkout start and end times
    };
}

/**
 * Maps a Shopify order to our order model
 * @param order The Shopify order
 * @param shopId The shop ID
 * @param riskAnalysis The risk analysis results
 * @returns Formatted order object ready to be saved to database
 */
export function mapShopifyOrderToModel(order: any, shopId: string, riskAnalysis: any) {
    return {
        shopId,
        orderId: order.id.toString(),
        orderNumber: order.order_number?.toString() || order.name?.replace('#', '') || '',
        date: new Date(order.created_at),
        customer: {
            id: order.customer?.id?.toString(),
            firstName: order.customer?.first_name || 'Guest',
            lastName: order.customer?.last_name || 'Customer',
            email: order.customer?.email || '',
            phone: order.customer?.phone,
            totalOrders: order.customer?.orders_count,
            totalSpent: order.customer?.total_spent ? parseFloat(order.customer.total_spent) : undefined
        },
        financialStatus: order.financial_status || 'unknown',
        fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
        totalPrice: parseFloat(order.total_price || '0'),
        currency: order.currency || 'USD',
        items: (order.line_items || []).map((item: any) => ({
            id: item.id.toString(),
            title: item.title || 'Unknown Product',
            quantity: item.quantity || 1,
            price: parseFloat(item.price || '0'),
            sku: item.sku
        })),
        shippingAddress: order.shipping_address ? {
            address1: order.shipping_address.address1 || '',
            address2: order.shipping_address.address2 || '',
            city: order.shipping_address.city || '',
            province: order.shipping_address.province || '',
            zip: order.shipping_address.zip || '',
            country: order.shipping_address.country || ''
        } : undefined,
        billingAddress: order.billing_address ? {
            address1: order.billing_address.address1 || '',
            address2: order.billing_address.address2 || '',
            city: order.billing_address.city || '',
            province: order.billing_address.province || '',
            zip: order.billing_address.zip || '',
            country: order.billing_address.country || ''
        } : undefined,
        riskAnalysis,
        createdAt: new Date(),
        updatedAt: new Date()
    };
} 