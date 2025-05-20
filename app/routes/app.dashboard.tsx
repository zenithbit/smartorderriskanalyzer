import { useState, useCallback, useEffect, useMemo } from "react";
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
import { authenticate, registerWebhooks } from "../shopify.server";
import { getTrialStatus, startTrial } from "../models/store.server";
import { getDashboardStats, getRiskByRegion, getDashboardOrders } from "../models/order.server";

// Define types for trial status
type TrialStatus = {
    isActive: boolean;
    daysRemaining: number;
    startedAt: string | null;
};

// Define dashboard-specific types
type DashboardOrder = {
    id: string;
    date: string;
    customer: string;
    total: string;
    riskScore: number;
    riskReasons: string;
    status: string;
};

type RegionRiskData = {
    region: string;
    orders: number;
    riskPercentage: number;
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

    // Get real data from database instead of mocks
    let dashboardOrders: DashboardOrder[] = [];
    let monthlyStats = {
        totalOrders: 0,
        riskyOrders: 0,
        riskPercentage: 0,
        averageRiskScore: 0
    };
    let riskByRegion: RegionRiskData[] = [];

    try {
        // Get orders for display in the dashboard
        dashboardOrders = await getDashboardOrders(shopId);

        // Get dashboard statistics
        monthlyStats = await getDashboardStats(shopId);

        // Get risk by region
        riskByRegion = await getRiskByRegion(shopId);

        console.log("Loaded dashboard data:", {
            orderCount: dashboardOrders.length,
            monthlyStats,
            regionCount: riskByRegion.length
        });
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        // If we fail to load real data, we'll fall back to the empty defaults
    }

    // Get actual trial status from MongoDB, fallback to default if not found
    let trialStatus: TrialStatus;
    try {
        const dbTrialStatus = await getTrialStatus(shopId);
        if (dbTrialStatus) {
            trialStatus = {
                isActive: dbTrialStatus.isActive,
                daysRemaining: dbTrialStatus.daysRemaining,
                startedAt: dbTrialStatus.startedAt ? dbTrialStatus.startedAt.toISOString() : null
            };
        } else {
            trialStatus = {
                isActive: false,
                daysRemaining: 14,
                startedAt: null
            };
        }
    } catch (error) {
        console.error("Error fetching trial status:", error);
        trialStatus = {
            isActive: false,
            daysRemaining: 14,
            startedAt: null
        };
    }

    return json({
        riskyOrders: dashboardOrders,
        monthlyStats,
        riskByRegion,
        trialStatus,
        shopId,
    });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shopId = session.shop;

    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "startTrial") {
        try {
            console.log("Starting free trial for shop:", shopId);

            // Save trial data to MongoDB
            console.log("Calling startTrial to save data to MongoDB");
            const updatedTrialStatus = await startTrial(shopId);
            console.log("MongoDB response:", JSON.stringify(updatedTrialStatus));

            // Register the webhook for order creation
            let webhookRegistered = false;
            try {
                // Register webhook for order creation
                const result = await registerWebhooks({
                    session
                });

                console.log("Webhook registration result:", JSON.stringify(result));

                // If we got here without an error, webhooks were likely registered
                webhookRegistered = true;
                console.log("Order webhook registration completed");
            } catch (webhookError) {
                console.error("Error registering webhook:", webhookError);
            }

            // Convert MongoDB date to ISO string for the response
            return json<ActionData>({
                success: true,
                message: "Trial started successfully",
                trialStatus: {
                    isActive: updatedTrialStatus?.isActive ?? true,
                    daysRemaining: updatedTrialStatus?.daysRemaining ?? 14,
                    startedAt: updatedTrialStatus?.startedAt ? updatedTrialStatus.startedAt.toISOString() : new Date().toISOString()
                },
                webhookRegistered
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

    // Log initial webhook registration status
    useEffect(() => {
        console.log("Initial webhookRegistered state:", webhookRegistered);
    }, []);

    // When the action returns with trial data, update the local state
    useEffect(() => {
        console.log("Fetcher data:", fetcher.data);
        console.log("Webhook registered status:", fetcher.data?.webhookRegistered);

        if (fetcher.data?.success) {
            if (fetcher.data?.trialStatus) {
                setLocalTrialStatus(fetcher.data.trialStatus);
                console.log("Setting webhook registered to:", fetcher.data.webhookRegistered);
            }
            if (fetcher.data?.webhookRegistered !== undefined) {
                setWebhookRegistered(fetcher.data.webhookRegistered);
            }
        }
    }, [fetcher.data]);

    // Filter orders based on selected tab
    const filteredOrders = useMemo(() => {
        if (!riskyOrders || riskyOrders.length === 0) return [];

        switch (selected) {
            case 1: // High Risk
                return riskyOrders.filter(order => order.riskScore >= 75);
            case 2: // Medium Risk
                return riskyOrders.filter(order => order.riskScore >= 50 && order.riskScore < 75);
            case 3: // Low Risk
                return riskyOrders.filter(order => order.riskScore < 50);
            default: // All Orders
                return riskyOrders;
        }
    }, [riskyOrders, selected]);

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

    // Ensure we have order data, otherwise show empty state
    const hasOrders = riskyOrders && riskyOrders.length > 0;
    const hasFilteredOrders = filteredOrders.length > 0;
    const rows = hasFilteredOrders
        ? filteredOrders.map((order) => [
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
        ])
        : [];

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
                                        <Text as="p" variant="headingXl">{hasOrders ? riskyOrders.filter(order => order.status !== "Approved").length : 0}</Text>
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
                                {riskByRegion.length > 0 ? (
                                    riskByRegion.map((region) => (
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
                                    ))
                                ) : (
                                    <EmptyState
                                        heading="No regional data"
                                        image=""
                                        imageContained
                                    >
                                        <p>Regional risk data will appear once orders are received.</p>
                                    </EmptyState>
                                )}
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
                                    {hasFilteredOrders ? (
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
                                    ) : (
                                        <div style={{ padding: '2rem 0' }}>
                                            <EmptyState
                                                heading={hasOrders ? "No matching orders" : "No orders to display"}
                                                image=""
                                                imageContained
                                            >
                                                <p>{hasOrders
                                                    ? "No orders match the current filter criteria."
                                                    : "When orders are received, they will be analyzed for risk and displayed here."}</p>
                                            </EmptyState>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {hasFilteredOrders && (
                                <div style={{ padding: '16px', textAlign: 'center' }}>
                                    <ButtonGroup>
                                        <Button>Previous</Button>
                                        <Button>Next</Button>
                                    </ButtonGroup>
                                </div>
                            )}
                        </Card>
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
} 