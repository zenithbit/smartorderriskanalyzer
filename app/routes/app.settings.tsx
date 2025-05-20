import { useState, useCallback, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    TextField,
    RangeSlider,
    Button,
    InlineStack,
    Divider,
    ChoiceList,
    Checkbox,
    FormLayout,
    Select,
    Box,
    Banner,
    List,
    Toast
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getStoreSettings, createDefaultStoreSettings, updateStoreSettings, StoreSettings } from "../models/store.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shopId = session.shop;

    // Get store settings from MongoDB
    let settings = await getStoreSettings(shopId);

    // If no settings found, create default ones
    if (!settings) {
        settings = await createDefaultStoreSettings(shopId);
    }

    return json({ settings, shopId });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shopId = session.shop;

    const formData = await request.formData();
    const settingsData = JSON.parse(formData.get("settings") as string);

    // Update store settings in MongoDB
    const updatedSettings = await updateStoreSettings(shopId, settingsData);

    return json({
        success: true,
        message: "Settings saved successfully",
        settings: updatedSettings
    });
};

export default function Settings() {
    const { settings } = useLoaderData<typeof loader>();
    const submit = useSubmit();

    // Local state for settings form
    const [highRiskThreshold, setHighRiskThreshold] = useState(settings.riskThresholds.high);
    const [mediumRiskThreshold, setMediumRiskThreshold] = useState(settings.riskThresholds.medium);
    const [emailNotifications, setEmailNotifications] = useState(settings.notifications.email.enabled);
    const [slackNotifications, setSlackNotifications] = useState(settings.notifications.slack.enabled);
    const [slackWebhookUrl, setSlackWebhookUrl] = useState(settings.notifications.slack.webhookUrl);
    const [notificationEmail, setNotificationEmail] = useState(settings.notifications.email.address);
    const [alertFrequency, setAlertFrequency] = useState<'immediate' | 'hourly' | 'daily'>(settings.notifications.frequency);
    const [selectedAutomation, setSelectedAutomation] = useState<string[]>([]);
    const [customEmailTemplate, setCustomEmailTemplate] = useState(settings.automations.customEmailTemplate || "");
    const [enableAIFeedback, setEnableAIFeedback] = useState(settings.aiSettings.enableFeedback);
    const [aiDataSharing, setAIDataSharing] = useState<'none' | 'anonymized' | 'full'>(settings.aiSettings.dataSharing);
    const [riskFactors, setRiskFactors] = useState(settings.riskFactors);
    const [showToast, setShowToast] = useState(false);

    // Set up automation selections based on DB values
    useEffect(() => {
        const automations = [];
        if (settings.automations.holdHighRiskOrders) automations.push('hold_orders');
        if (settings.automations.emailVerification) automations.push('email_verification');
        if (settings.automations.cancelHighRiskOrders) automations.push('cancel_order');
        if (settings.automations.customEmail) automations.push('custom_email');
        if (settings.automations.flagForReview) automations.push('flag_for_review');
        setSelectedAutomation(automations);
    }, [settings]);

    const handleRiskFactorChange = (factor: string, checked: boolean) => {
        setRiskFactors(prev => ({ ...prev, [factor]: checked }));
    };

    const handleAutomationChange = useCallback((value: string[]) => {
        setSelectedAutomation(value);
    }, []);

    const handleRangeChange = (value: number | [number, number]) => {
        // Ensure we only get single numbers
        if (typeof value === 'number') {
            return value;
        }
        return value[0];
    };

    const handleAlertFrequencyChange = useCallback(
        (value: string) => setAlertFrequency(value as 'immediate' | 'hourly' | 'daily'),
        []
    );

    const handleAIDataSharingChange = useCallback(
        (value: string) => setAIDataSharing(value as 'none' | 'anonymized' | 'full'),
        []
    );

    const alertFrequencyOptions = [
        { label: 'Immediate', value: 'immediate' },
        { label: 'Hourly summary', value: 'hourly' },
        { label: 'Daily summary', value: 'daily' }
    ];

    const aiDataSharingOptions = [
        { label: 'No data sharing', value: 'none' },
        { label: 'Share anonymized data for AI improvement', value: 'anonymized' },
        { label: 'Share full data for best results', value: 'full' }
    ];

    const handleSaveSettings = () => {
        const settingsData: Partial<StoreSettings> = {
            riskThresholds: {
                high: highRiskThreshold,
                medium: mediumRiskThreshold
            },
            riskFactors: riskFactors,
            notifications: {
                email: {
                    enabled: emailNotifications,
                    address: notificationEmail
                },
                slack: {
                    enabled: slackNotifications,
                    webhookUrl: slackWebhookUrl
                },
                frequency: alertFrequency
            },
            automations: {
                holdHighRiskOrders: selectedAutomation.includes('hold_orders'),
                emailVerification: selectedAutomation.includes('email_verification'),
                cancelHighRiskOrders: selectedAutomation.includes('cancel_order'),
                customEmail: selectedAutomation.includes('custom_email'),
                flagForReview: selectedAutomation.includes('flag_for_review'),
                customEmailTemplate: customEmailTemplate
            },
            aiSettings: {
                enableFeedback: enableAIFeedback,
                dataSharing: aiDataSharing
            }
        };

        submit(
            { settings: JSON.stringify(settingsData) },
            { method: "post", replace: true }
        );

        setShowToast(true);
    };

    return (
        <Page>
            <TitleBar title="Settings" />
            <BlockStack gap="500">
                <Layout>
                    <Layout.Section>
                        <Banner
                            title="Configure your risk analysis system"
                            tone="info"
                        >
                            <p>Customize how the AI detects and responds to risky orders. The system will learn from your feedback over time to improve detection accuracy.</p>
                        </Banner>
                    </Layout.Section>
                </Layout>

                <Layout>
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Risk Threshold Settings</Text>

                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd">High Risk Threshold ({highRiskThreshold})</Text>
                                    <RangeSlider
                                        label="High Risk Threshold"
                                        labelHidden
                                        output
                                        min={50}
                                        max={100}
                                        value={highRiskThreshold}
                                        onChange={(value) => setHighRiskThreshold(handleRangeChange(value))}
                                        prefix={<Text as="span" variant="bodyMd">50</Text>}
                                        suffix={<Text as="span" variant="bodyMd">100</Text>}
                                    />
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd">Medium Risk Threshold ({mediumRiskThreshold})</Text>
                                    <RangeSlider
                                        label="Medium Risk Threshold"
                                        labelHidden
                                        output
                                        min={25}
                                        max={74}
                                        value={mediumRiskThreshold}
                                        onChange={(value) => setMediumRiskThreshold(handleRangeChange(value))}
                                        prefix={<Text as="span" variant="bodyMd">25</Text>}
                                        suffix={<Text as="span" variant="bodyMd">74</Text>}
                                    />
                                </BlockStack>

                                <Text as="p" variant="bodyMd">Orders with risk scores lower than {mediumRiskThreshold} will be considered low risk.</Text>
                            </BlockStack>
                        </Card>
                    </Layout.Section>

                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Risk Factors</Text>
                                <Text as="p" variant="bodyMd">Select which factors the AI should consider when calculating risk scores:</Text>

                                <FormLayout>
                                    <Checkbox
                                        label="Order Value"
                                        checked={riskFactors.orderValue}
                                        onChange={(checked) => handleRiskFactorChange('orderValue', checked)}
                                        helpText="Consider unusually high order values as a risk factor"
                                    />
                                    <Checkbox
                                        label="Customer Purchase History"
                                        checked={riskFactors.customerHistory}
                                        onChange={(checked) => handleRiskFactorChange('customerHistory', checked)}
                                        helpText="New customers or customers with previous cancellations/refunds"
                                    />
                                    <Checkbox
                                        label="IP Location"
                                        checked={riskFactors.ipLocation}
                                        onChange={(checked) => handleRiskFactorChange('ipLocation', checked)}
                                        helpText="IP address location differs from shipping address"
                                    />
                                    <Checkbox
                                        label="Checkout Speed"
                                        checked={riskFactors.checkoutSpeed}
                                        onChange={(checked) => handleRiskFactorChange('checkoutSpeed', checked)}
                                        helpText="Unusually fast checkout process"
                                    />
                                    <Checkbox
                                        label="Shipping/Billing Address Mismatch"
                                        checked={riskFactors.addressMismatch}
                                        onChange={(checked) => handleRiskFactorChange('addressMismatch', checked)}
                                        helpText="Different shipping and billing addresses"
                                    />
                                    <Checkbox
                                        label="Email Domain"
                                        checked={riskFactors.emailDomain}
                                        onChange={(checked) => handleRiskFactorChange('emailDomain', checked)}
                                        helpText="Temporary email domains"
                                    />
                                    <Checkbox
                                        label="Order Time"
                                        checked={riskFactors.orderTime}
                                        onChange={(checked) => handleRiskFactorChange('orderTime', checked)}
                                        helpText="Orders placed during unusual hours (late night)"
                                    />
                                    <Checkbox
                                        label="Gift Card Use"
                                        checked={riskFactors.giftCardUse}
                                        onChange={(checked) => handleRiskFactorChange('giftCardUse', checked)}
                                        helpText="Orders paid with gift cards"
                                    />
                                    <Checkbox
                                        label="Quantity Spike"
                                        checked={riskFactors.quantitySpike}
                                        onChange={(checked) => handleRiskFactorChange('quantitySpike', checked)}
                                        helpText="Unusual quantity of the same item"
                                    />
                                </FormLayout>
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>

                <Layout>
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Alert System</Text>
                                <Text as="p" variant="bodyMd">Configure how you want to be notified about high-risk orders</Text>

                                <Select
                                    label="Alert Frequency"
                                    options={alertFrequencyOptions}
                                    onChange={handleAlertFrequencyChange}
                                    value={alertFrequency}
                                    helpText="How often you want to receive notifications about risky orders"
                                />

                                <Checkbox
                                    label="Email Notifications"
                                    checked={emailNotifications}
                                    onChange={setEmailNotifications}
                                />

                                {emailNotifications && (
                                    <TextField
                                        label="Notification Email"
                                        value={notificationEmail}
                                        onChange={setNotificationEmail}
                                        autoComplete="email"
                                        placeholder="Enter email address"
                                    />
                                )}

                                <Divider />

                                <Checkbox
                                    label="Slack Notifications"
                                    checked={slackNotifications}
                                    onChange={setSlackNotifications}
                                />

                                {slackNotifications && (
                                    <TextField
                                        label="Slack Webhook URL"
                                        value={slackWebhookUrl}
                                        onChange={setSlackWebhookUrl}
                                        autoComplete="off"
                                        placeholder="https://hooks.slack.com/services/..."
                                    />
                                )}
                            </BlockStack>
                        </Card>
                    </Layout.Section>

                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Automated Actions</Text>
                                <Text as="p" variant="bodyMd">Select what actions to take automatically for high-risk orders:</Text>

                                <ChoiceList
                                    title="Automated actions"
                                    titleHidden
                                    choices={[
                                        { value: 'hold_orders', label: 'Hold high-risk orders for review' },
                                        { value: 'email_verification', label: 'Send email verification to customer' },
                                        { value: 'cancel_order', label: 'Automatically cancel orders above 90 risk score' },
                                        { value: 'custom_email', label: 'Send custom email to merchant' },
                                        { value: 'flag_for_review', label: 'Flag for manual review without holding' },
                                    ]}
                                    selected={selectedAutomation}
                                    onChange={handleAutomationChange}
                                    allowMultiple
                                />

                                {selectedAutomation.includes('custom_email') && (
                                    <TextField
                                        label="Custom Email Template"
                                        value={customEmailTemplate}
                                        onChange={setCustomEmailTemplate}
                                        autoComplete="off"
                                        multiline={4}
                                        placeholder="Enter your custom email template. Use {{orderNumber}} to include the order number."
                                    />
                                )}
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>

                <Layout>
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">AI Learning Settings</Text>
                                <Text as="p" variant="bodyMd">Configure how the AI learns from your feedback</Text>

                                <Checkbox
                                    label="Enable AI feedback loop"
                                    checked={enableAIFeedback}
                                    onChange={setEnableAIFeedback}
                                    helpText="Allow the system to learn from your responses to improve future risk detection"
                                />

                                {enableAIFeedback && (
                                    <Select
                                        label="Data Sharing Level"
                                        options={aiDataSharingOptions}
                                        onChange={handleAIDataSharingChange}
                                        value={aiDataSharing}
                                        helpText="Control how much order data is used for AI improvement"
                                    />
                                )}

                                <Box paddingBlockStart="400" paddingBlockEnd="400">
                                    <Text as="h3" variant="headingMd">How AI Learning Works</Text>
                                    <Text as="p" variant="bodyMd">When you approve or reject the AI's risk assessment:</Text>
                                    <List type="bullet">
                                        <List.Item>The system records your feedback</List.Item>
                                        <List.Item>Your feedback adjusts the AI model weights</List.Item>
                                        <List.Item>Future risk assessments become more accurate for your store</List.Item>
                                        <List.Item>Helps identify patterns specific to your business</List.Item>
                                    </List>
                                </Box>
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>

                <Layout>
                    <Layout.Section>
                        <InlineStack align="end">
                            <Button>Cancel</Button>
                            <Button variant="primary" onClick={handleSaveSettings}>Save Settings</Button>
                        </InlineStack>
                    </Layout.Section>
                </Layout>
            </BlockStack>

            {showToast && (
                <Toast
                    content="Settings saved successfully"
                    onDismiss={() => setShowToast(false)}
                    duration={4000}
                />
            )}
        </Page>
    );
} 