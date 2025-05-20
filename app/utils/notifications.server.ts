import { getStoreSettings, getTrialStatus } from "../models/store.server";
import type { Order } from "../models/order.server";

/**
 * Sends notifications for a high-risk order based on store settings
 * @param order The analyzed order
 * @param shopId The shop ID
 */
export async function sendRiskNotifications(order: Order, shopId: string) {
    try {
        // Get store settings and trial status
        const storeSettings = await getStoreSettings(shopId);
        const trialStatus = await getTrialStatus(shopId);

        // Check if the user is on a Pro plan or in trial
        const isPro = trialStatus?.isActive || trialStatus?.plan === 'pro' || trialStatus?.plan === 'business';

        // Only send notifications for medium and high-risk orders
        if (order.riskAnalysis.level !== 'high' && order.riskAnalysis.level !== 'medium') {
            console.log(`No notification needed for low-risk order #${order.orderNumber}`);
            return;
        }

        // Check notification settings
        const notifications = storeSettings?.notifications;
        if (!notifications) {
            console.log("No notification settings found for shop:", shopId);
            return;
        }

        // Free plan users only get email notifications for high-risk orders
        if (!isPro && order.riskAnalysis.level !== 'high') {
            console.log("Free plan users only receive notifications for high-risk orders");
            return;
        }

        // Check notification frequency
        // For immediate notifications, send right away
        // For hourly/daily, would need to queue these up in a separate process
        if (notifications.frequency !== 'immediate') {
            console.log(`Notification queued for ${notifications.frequency} delivery`);
            // In a real implementation, this would add to a queue
            return;
        }

        // Send email notification if enabled
        if (notifications.email?.enabled && notifications.email?.address) {
            await sendEmailNotification(
                notifications.email.address,
                order,
                storeSettings?.automations?.customEmailTemplate
            );
        }

        // Send Slack notification if enabled (Pro plan only)
        if (isPro && notifications.slack?.enabled && notifications.slack?.webhookUrl) {
            await sendSlackNotification(
                notifications.slack.webhookUrl,
                order
            );
        }

        console.log(`Notifications sent for order #${order.orderNumber}`);
    } catch (error) {
        console.error("Error sending notifications:", error);
    }
}

/**
 * Sends an email notification about a risky order
 * This would integrate with an email service in a real implementation
 */
async function sendEmailNotification(email: string, order: Order, customTemplate?: string) {
    // In a real implementation, this would send an actual email
    // For now, just log the information
    console.log(`[EMAIL NOTIFICATION] Would send email to ${email} for Order #${order.orderNumber}`);
    console.log(`Risk level: ${order.riskAnalysis.level}, Score: ${order.riskAnalysis.score}`);
    console.log(`Risk factors: ${order.riskAnalysis.factors.join(', ')}`);

    if (customTemplate) {
        console.log("Using custom email template");
    } else {
        console.log("Using default email template");
    }

    // In production, this would use a service like SendGrid, AWS SES, etc.
    return true;
}

/**
 * Sends a Slack notification about a risky order
 * This would post to a Slack webhook in a real implementation
 */
async function sendSlackNotification(webhookUrl: string, order: Order) {
    // In a real implementation, this would post to the Slack webhook
    // For now, just log the information
    console.log(`[SLACK NOTIFICATION] Would post to Slack webhook for Order #${order.orderNumber}`);
    console.log(`Risk level: ${order.riskAnalysis.level}, Score: ${order.riskAnalysis.score}`);
    console.log(`Risk factors: ${order.riskAnalysis.factors.join(', ')}`);

    // In production, this would make an actual HTTP request to the Slack webhook
    return true;
} 