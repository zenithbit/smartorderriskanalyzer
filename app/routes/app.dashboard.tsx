import { useState, useCallback, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    LegacyFilters,
    DataTable,
    Badge,
    Tabs,
    Button,
    EmptyState,
    Popover,
    ActionList,
    Icon,
    Grid,
    ProgressBar,
    ButtonGroup,
    Banner,
    Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CircleUpIcon, GlobeIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// Define types for trial status
type TrialStatus = {
    isActive: boolean;
    daysRemaining: number;
    startedAt: string | null;
};

// Define types for action response
type ActionData = {
    success: boolean;
    message: string;
    trialStatus?: TrialStatus;
    webhookRegistered?: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shopId = session.shop;

    // Mock data for the dashboard
    const mockRiskyOrders = [
        {
            id: "#1001",
            date: "2023-06-01",
            customer: "John Doe",
            total: "$245.00",
            riskScore: 87,
            riskReasons: "High value, unusual IP",
            status: "On Hold"
        },
        {
            id: "#1002",
            date: "2023-06-02",
            customer: "Jane Smith",
            total: "$159.99",
            riskScore: 63,
            riskReasons: "Unusual checkout pattern",
            status: "Pending Review"
        },
        {
            id: "#1003",
            date: "2023-06-03",
            customer: "Michael Johnson",
            total: "$324.50",
            riskScore: 92,
            riskReasons: "Suspicious IP, high value, address mismatch",
            status: "On Hold"
        },
        {
            id: "#1004",
            date: "2023-06-03",
            customer: "Sarah Williams",
            total: "$89.99",
            riskScore: 37,
            riskReasons: "New customer",
            status: "Approved"
        },
        {
            id: "#1005",
            date: "2023-06-04",
            customer: "Robert Brown",
            total: "$425.00",
            riskScore: 76,
            riskReasons: "Temporary email, high value",
            status: "On Hold"
        },
    ];

    const monthlyStats = {
        totalOrders: 156,
        riskyOrders: 28,
        riskPercentage: 17.9,
        averageRiskScore: 54
    };

    const riskByRegion = [
        { region: "North America", orders: 82, riskPercentage: 12 },
        { region: "Europe", orders: 45, riskPercentage: 22 },
        { region: "Asia", orders: 23, riskPercentage: 26 },
        { region: "Other", orders: 6, riskPercentage: 33 }
    ];

    // Mock trial status - in a real app, we'd fetch this from MongoDB
    const trialStatus: TrialStatus = {
        isActive: false,
        daysRemaining: 14,
        startedAt: null
    };

    return json({
        riskyOrders: mockRiskyOrders,
        monthlyStats,
        riskByRegion,
        trialStatus,
        shopId,
    });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "startTrial") {
        // In a real app, we would update database to activate the trial
        try {
            // Instead of trying to register webhooks directly, we'll activate the
            // order analysis feature in the app's state
            console.log("Starting free trial for shop:", session.shop);

            return json<ActionData>({
                success: true,
                message: "Trial started successfully",
                trialStatus: {
                    isActive: true,
                    daysRemaining: 14,
                    startedAt: new Date().toISOString()
                },
                webhookRegistered: true // Assume webhooks are already registered through shopify.app.toml
            });
        } catch (error) {
            console.error("Error starting trial:", error);
            return json<ActionData>({
                success: false,
                message: "Failed to start trial: " + (error instanceof Error ? error.message : String(error)),
                webhookRegistered: false
            });
        }
    }

    return json<ActionData>({ success: false, message: "Invalid action" });
};

export default function Dashboard() {
    const { riskyOrders, monthlyStats, riskByRegion, trialStatus } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    const [selected, setSelected] = useState(0);
    const [popoverActive, setPopoverActive] = useState(false);
    const [filterValue, setFilterValue] = useState("today");
    const [trialModalOpen, setTrialModalOpen] = useState(false);
    const [localTrialStatus, setLocalTrialStatus] = useState<TrialStatus>(trialStatus);
    const [webhookRegistered, setWebhookRegistered] = useState(false);

    // When the action returns with trial data, update the local state
    useEffect(() => {
        if (fetcher.data?.success) {
            if (fetcher.data?.trialStatus) {
                setLocalTrialStatus(fetcher.data.trialStatus);
            }
            if (fetcher.data?.webhookRegistered !== undefined) {
                setWebhookRegistered(fetcher.data.webhookRegistered);
            }
        }
    }, [fetcher.data]);

    const togglePopoverActive = useCallback(
        () => setPopoverActive((popoverActive) => !popoverActive),
        [],
    );

    const handleTabChange = useCallback(
        (selectedTabIndex: number) => setSelected(selectedTabIndex),
        [],
    );

    const handleFilterChange = useCallback(
        (value: string) => setFilterValue(value),
        [],
    );

    const handleStartTrial = () => {
        fetcher.submit(
            { action: "startTrial" },
            { method: "post" }
        );
        setTrialModalOpen(false);
    };

    const tabs = [
        {
            id: "all-orders",
            content: "All Orders",
            accessibilityLabel: "All orders",
            panelID: "all-orders-content",
        },
        {
            id: "high-risk",
            content: "High Risk",
            accessibilityLabel: "High risk orders",
            panelID: "high-risk-content",
        },
        {
            id: "medium-risk",
            content: "Medium Risk",
            accessibilityLabel: "Medium risk orders",
            panelID: "medium-risk-content",
        },
        {
            id: "low-risk",
            content: "Low Risk",
            accessibilityLabel: "Low risk orders",
            panelID: "low-risk-content",
        },
    ];

    const filters = [
        {
            key: "filterKey",
            label: "Time Period",
            filter: (
                <Popover
                    active={popoverActive}
                    activator={
                        <Button onClick={togglePopoverActive} disclosure>
                            {filterValue === "today" ? "Today" :
                                filterValue === "yesterday" ? "Yesterday" :
                                    filterValue === "lastWeek" ? "Last 7 days" :
                                        "Last 30 days"}
                        </Button>
                    }
                    onClose={togglePopoverActive}
                >
                    <ActionList
                        actionRole="menuitem"
                        items={[
                            {
                                content: 'Today',
                                onAction: () => {
                                    handleFilterChange("today");
                                    togglePopoverActive();
                                },
                            },
                            {
                                content: 'Yesterday',
                                onAction: () => {
                                    handleFilterChange("yesterday");
                                    togglePopoverActive();
                                },
                            },
                            {
                                content: 'Last 7 days',
                                onAction: () => {
                                    handleFilterChange("lastWeek");
                                    togglePopoverActive();
                                },
                            },
                            {
                                content: 'Last 30 days',
                                onAction: () => {
                                    handleFilterChange("lastMonth");
                                    togglePopoverActive();
                                },
                            },
                            {
                                content: 'Custom',
                                onAction: () => {
                                    handleFilterChange("custom");
                                    togglePopoverActive();
                                },
                            },
                        ]}
                    />
                </Popover>
            ),
            shortcut: true,
        },
    ];

    const getRiskScoreBadge = (score: number) => {
        if (score >= 75) {
            return <Badge tone="critical">{`High Risk (${score})`}</Badge>;
        } else if (score >= 50) {
            return <Badge tone="warning">{`Medium Risk (${score})`}</Badge>;
        } else {
            return <Badge tone="success">{`Low Risk (${score})`}</Badge>;
        }
    };

    const rows = riskyOrders.map((order) => [
        order.id,
        order.date,
        order.customer,
        order.total,
        getRiskScoreBadge(order.riskScore),
        order.riskReasons,
        <Badge
            progress={order.status === "On Hold" ? "incomplete" :
                order.status === "Pending Review" ? "partiallyComplete" : "complete"}
        >
            {order.status}
        </Badge>
    ]);

    return (
        <Page>
            <TitleBar title="Risk Analysis Dashboard" />
            <BlockStack gap="500">
                {/* Trial Banner */}
                {!localTrialStatus.isActive && (
                    <Layout>
                        <Layout.Section>
                            <Banner
                                title="Start your 14-day free Pro trial"
                                tone="success"
                                action={{
                                    content: "Start Free Trial",
                                    onAction: () => setTrialModalOpen(true),
                                }}
                            >
                                <p>Try all features including unlimited orders, slack notifications, and automated actions for 14 days. No credit card required.</p>
                            </Banner>
                        </Layout.Section>
                    </Layout>
                )}

                {localTrialStatus.isActive && (
                    <Layout>
                        <Layout.Section>
                            <Banner
                                title={`Your Pro trial is active - ${localTrialStatus.daysRemaining} days remaining`}
                                tone="info"
                                action={{
                                    content: "Upgrade to Pro",
                                    url: "/app/pricing",
                                }}
                            >
                                <p>You have access to all Pro features. Your trial will expire in {localTrialStatus.daysRemaining} days. {webhookRegistered ? 'Order tracking is active - we\'ll analyze all new orders for risk.' : 'Order tracking setup in progress...'}</p>
                            </Banner>
                        </Layout.Section>
                    </Layout>
                )}

                {/* Trial Confirmation Modal */}
                <Modal
                    open={trialModalOpen}
                    onClose={() => setTrialModalOpen(false)}
                    title="Start your 14-day free trial"
                    primaryAction={{
                        content: "Start Trial",
                        onAction: handleStartTrial,
                        loading: fetcher.state === "submitting"
                    }}
                    secondaryActions={[
                        {
                            content: "Cancel",
                            onAction: () => setTrialModalOpen(false),
                        },
                    ]}
                >
                    <Modal.Section>
                        <BlockStack gap="400">
                            <Text as="p" variant="bodyMd">
                                You're about to start your 14-day free trial of the Pro plan. During this period, you'll have access to:
                            </Text>
                            <BlockStack gap="200">
                                <Text as="p" variant="bodyMd">• Unlimited orders</Text>
                                <Text as="p" variant="bodyMd">• Advanced risk analytics</Text>
                                <Text as="p" variant="bodyMd">• Slack notifications</Text>
                                <Text as="p" variant="bodyMd">• Automated order handling</Text>
                                <Text as="p" variant="bodyMd">• AI-powered risk explanations</Text>
                            </BlockStack>
                            <Text as="p" variant="bodyMd">
                                No credit card required. You can cancel anytime.
                            </Text>
                        </BlockStack>
                    </Modal.Section>
                </Modal>

                {/* Summary Cards */}
                <Layout>
                    <Layout.Section>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                                <Card>
                                    <BlockStack gap="100">
                                        <Text as="h2" variant="headingMd">Total Orders</Text>
                                        <Text as="p" variant="headingXl">{monthlyStats.totalOrders}</Text>
                                        <Text as="p" variant="bodySm">Last 30 days</Text>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                                <Card>
                                    <BlockStack gap="100">
                                        <Text as="h2" variant="headingMd">Risky Orders</Text>
                                        <Text as="p" variant="headingXl">{monthlyStats.riskyOrders}</Text>
                                        <Text as="p" variant="bodySm">Risk rate: {monthlyStats.riskPercentage}%</Text>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                                <Card>
                                    <BlockStack gap="100">
                                        <Text as="h2" variant="headingMd">Average Risk Score</Text>
                                        <Text as="p" variant="headingXl">{monthlyStats.averageRiskScore}</Text>
                                        <Text as="p" variant="bodySm">Scale: 0-100</Text>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                                <Card>
                                    <BlockStack gap="100">
                                        <Text as="h2" variant="headingMd">Actions Needed</Text>
                                        <Text as="p" variant="headingXl">{riskyOrders.filter(order => order.status !== "Approved").length}</Text>
                                        <Text as="p" variant="bodySm">Orders requiring review</Text>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                        </Grid>
                    </Layout.Section>
                </Layout>

                {/* Risk by Region */}
                <Layout>
                    <Layout.Section variant="oneThird">
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">
                                    <Icon source={GlobeIcon} />
                                    <Text as="span"> Risk by Region</Text>
                                </Text>
                                {riskByRegion.map((region) => (
                                    <BlockStack key={region.region} gap="200">
                                        <BlockStack gap="100">
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text as="span" variant="bodyMd">{region.region}</Text>
                                                <Text as="span" variant="bodyMd">{region.riskPercentage}% risk rate</Text>
                                            </div>
                                            <ProgressBar progress={region.riskPercentage} />
                                        </BlockStack>
                                        <Text as="p" variant="bodySm">{region.orders} orders total</Text>
                                    </BlockStack>
                                ))}
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">
                                    <Icon source={CircleUpIcon} />
                                    <Text as="span"> Risk Score Distribution</Text>
                                </Text>
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <EmptyState
                                        heading="Charts coming soon"
                                        image=""
                                        imageContained
                                    >
                                        <p>Detailed risk score distribution charts will be available in the next update.</p>
                                    </EmptyState>
                                </div>
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>

                {/* Orders Table */}
                <Layout>
                    <Layout.Section>
                        <Card>
                            <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange} />
                            <div style={{ padding: '16px' }}>
                                <LegacyFilters
                                    filters={filters}
                                    onQueryChange={() => { }}
                                    onQueryClear={() => { }}
                                    onClearAll={() => { }}
                                />
                                <div style={{ paddingTop: '16px' }}>
                                    <DataTable
                                        columnContentTypes={[
                                            'text',
                                            'text',
                                            'text',
                                            'text',
                                            'text',
                                            'text',
                                            'text',
                                        ]}
                                        headings={[
                                            'Order ID',
                                            'Date',
                                            'Customer',
                                            'Total',
                                            'Risk Score',
                                            'Risk Factors',
                                            'Status',
                                        ]}
                                        rows={rows}
                                    />
                                </div>
                            </div>
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                                <ButtonGroup>
                                    <Button>Previous</Button>
                                    <Button>Next</Button>
                                </ButtonGroup>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
} 