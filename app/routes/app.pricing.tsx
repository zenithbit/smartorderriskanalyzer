import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    Button,
    InlineStack,
    Divider,
    Box,
    Banner,
    InlineGrid,
    Icon
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { CheckIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);
    return null;
};

export default function Pricing() {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const handlePlanSelect = (plan: string) => {
        setSelectedPlan(plan);
        // In a real app, this would open a checkout or subscription flow
    };

    return (
        <Page>
            <TitleBar title="Pricing Plans" />
            <BlockStack gap="500">
                <Layout>
                    <Layout.Section>
                        <Banner
                            title="Choose the plan that's right for your business"
                            tone="info"
                        >
                            <p>All plans include a 14-day free trial. No credit card required to start.</p>
                        </Banner>
                    </Layout.Section>
                </Layout>

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                    {/* Free Plan */}
                    <Card>
                        <BlockStack gap="400">
                            <Text as="h2" variant="headingLg">Free</Text>
                            <Text as="p" variant="headingXl">$0<Text as="span" variant="bodyMd">/month</Text></Text>
                            <Text as="p" variant="bodyMd">Perfect for small stores just getting started</Text>
                            <Divider />
                            <BlockStack gap="200">
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Up to 50 orders/month</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Basic risk dashboard</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Email notifications</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Essential risk scoring</Text>
                                </InlineStack>
                            </BlockStack>
                            <Box paddingBlockStart="300">
                                <Button
                                    onClick={() => handlePlanSelect('free')}
                                    variant={selectedPlan === 'free' ? "primary" : undefined}
                                    fullWidth
                                >
                                    {selectedPlan === 'free' ? 'Current Plan' : 'Select Free Plan'}
                                </Button>
                            </Box>
                        </BlockStack>
                    </Card>

                    {/* Pro Plan */}
                    <Card>
                        <BlockStack gap="400">
                            <Text as="h2" variant="headingLg">Pro</Text>
                            <Text as="p" variant="headingXl">$19<Text as="span" variant="bodyMd">/month</Text></Text>
                            <Text as="p" variant="bodyMd">For growing businesses with regular order volumes</Text>
                            <Divider />
                            <BlockStack gap="200">
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Unlimited orders</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Advanced dashboard</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Email + Slack notifications</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Automated order processing</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">AI-powered risk explanation</Text>
                                </InlineStack>
                            </BlockStack>
                            <Box paddingBlockStart="300">
                                <Button
                                    onClick={() => handlePlanSelect('pro')}
                                    variant={selectedPlan === 'pro' ? "primary" : undefined}
                                    fullWidth
                                >
                                    {selectedPlan === 'pro' ? 'Current Plan' : 'Select Pro Plan'}
                                </Button>
                            </Box>
                        </BlockStack>
                    </Card>

                    {/* Business Plan */}
                    <Card>
                        <BlockStack gap="400">
                            <Text as="h2" variant="headingLg">Business</Text>
                            <Text as="p" variant="headingXl">$49<Text as="span" variant="bodyMd">/month</Text></Text>
                            <Text as="p" variant="bodyMd">For established businesses with high order volumes</Text>
                            <Divider />
                            <BlockStack gap="200">
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Everything in Pro plan</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Custom AI risk model</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Advanced analytics dashboard</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Priority support</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">Custom automation rules</Text>
                                </InlineStack>
                                <InlineStack gap="200" align="start">
                                    <Icon source={CheckIcon} />
                                    <Text as="span" variant="bodyMd">API access</Text>
                                </InlineStack>
                            </BlockStack>
                            <Box paddingBlockStart="300">
                                <Button
                                    onClick={() => handlePlanSelect('business')}
                                    variant={selectedPlan === 'business' ? "primary" : undefined}
                                    fullWidth
                                >
                                    {selectedPlan === 'business' ? 'Current Plan' : 'Select Business Plan'}
                                </Button>
                            </Box>
                        </BlockStack>
                    </Card>
                </InlineGrid>

                <Layout>
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Frequently Asked Questions</Text>

                                <BlockStack gap="300">
                                    <Text as="h3" variant="headingMd">How does the 14-day trial work?</Text>
                                    <Text as="p" variant="bodyMd">
                                        You can try all features of the Pro plan for 14 days. No credit card required.
                                        At the end of your trial, you can choose to subscribe or downgrade to the Free plan.
                                    </Text>
                                </BlockStack>

                                <BlockStack gap="300">
                                    <Text as="h3" variant="headingMd">Can I change plans later?</Text>
                                    <Text as="p" variant="bodyMd">
                                        Yes, you can upgrade or downgrade your plan at any time.
                                        When upgrading, you'll have immediate access to the new features.
                                        When downgrading, the change will take effect on your next billing cycle.
                                    </Text>
                                </BlockStack>

                                <BlockStack gap="300">
                                    <Text as="h3" variant="headingMd">How is the order limit calculated?</Text>
                                    <Text as="p" variant="bodyMd">
                                        The order limit for the Free plan is based on new orders placed per calendar month.
                                        Once you exceed 50 orders in a month, you'll need to upgrade to continue receiving risk analysis.
                                    </Text>
                                </BlockStack>

                                <BlockStack gap="300">
                                    <Text as="h3" variant="headingMd">Do you offer custom plans?</Text>
                                    <Text as="p" variant="bodyMd">
                                        Yes, for merchants with specific needs or extremely high order volumes,
                                        we can create a custom plan. Contact our support team to discuss.
                                    </Text>
                                </BlockStack>
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>

                <Layout>
                    <Layout.Section>
                        <InlineStack align="center" gap="400">
                            <Text as="span" variant="bodyMd">Need help choosing a plan?</Text>
                            <Button>Contact Support</Button>
                        </InlineStack>
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
} 