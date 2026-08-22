import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { typePolicies } from "./lib/apolloCache";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";
import {HelmetProvider} from "react-helmet-async";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./components/theme-provider";
import { initAnalytics } from "./utils/analytics";

// setting headers for authentication
const authLink = setContext((operation, { headers, skipPublicAccessToken }) => {
  const sessionToken = localStorage.getItem("qrtoken");
  const publicAccessToken = import.meta.env.VITE_PUBLIC_ACCESS_TOKEN;
  const isAuthenticationOperation = [
    "login",
    "register",
    "forgotPassword",
    "resetPassword",
    "CheckUsernameAvailability",
  ].includes(operation.operationName ?? "");
  const accessToken = isAuthenticationOperation
    ? undefined
    : sessionToken || (skipPublicAccessToken ? undefined : publicAccessToken);
  const usedPublicAccessToken = Boolean(
    accessToken && !sessionToken && accessToken === publicAccessToken,
  );
  
  // return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      // The deployed Strapi role currently requires the public credential for
      // recommendation-list collections. A signed-in session always wins.
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    usedPublicAccessToken,
  };
});

const publicCredentialFallbackLink = onError(({ networkError, operation, forward }) => {
  const statusCode = (networkError as { statusCode?: number; status?: number } | undefined)?.statusCode
    ?? (networkError as { statusCode?: number; status?: number } | undefined)?.status;
  const context = operation.getContext();

  if (statusCode !== 401 || !context.usedPublicAccessToken) return;

  const { authorization: _authorization, ...headersWithoutAuthorization } = context.headers ?? {};
  operation.setContext({
    ...context,
    headers: headersWithoutAuthorization,
    skipPublicAccessToken: true,
    usedPublicAccessToken: false,
  });

  return forward(operation);
});

// create a httpLink with the help of Graphql
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL,
});

// initalising the apollo client
const client = new ApolloClient({
  // link should be with the headers it it exist
  link: publicCredentialFallbackLink.concat(authLink).concat(httpLink),
  // current cache — typePolicies key Strapi entities by documentId so publish
  // mutations patch the rendered list entity (fixes the stale "Draft" label)
  cache: new InMemoryCache({ typePolicies }),
});

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <ApolloProvider client={client}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Toaster />
            <App />
          </ThemeProvider>
        </QueryClientProvider>
      </ApolloProvider>
    </APIProvider>
    </HelmetProvider>
  </StrictMode>
);
