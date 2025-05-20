import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useNavigation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Frame, Loading, SkeletonPage, Layout, SkeletonBodyText, Card, SkeletonDisplayText, BlockStack } from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <Frame>
        {isLoading && <Loading />}
        <NavMenu>
          <Link to="/app/dashboard" rel="home">
            Dashboard
          </Link>
          <Link to="/app/settings">Settings</Link>
          <Link to="/app/pricing">Pricing</Link>
        </NavMenu>

        {isLoading ? (
          <SkeletonPage>
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={6} />
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={3} />
                  </BlockStack>
                </Card>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={2} />
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </SkeletonPage>
        ) : (
          <Outlet />
        )}
      </Frame>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
