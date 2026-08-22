import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
} from "@apollo/client";
import { typePolicies } from "./lib/apolloCache";
import {
  createApolloTransport,
  resolveBrowserApolloCapabilities,
} from "./lib/apolloTransport";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";
import {HelmetProvider} from "react-helmet-async";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./components/theme-provider";
import { initAnalytics } from "./utils/analytics";

const apolloTransport = createApolloTransport({
  uri: import.meta.env.VITE_API_URL,
  getSessionToken: () => localStorage.getItem("qrtoken"),
  capabilities: resolveBrowserApolloCapabilities(import.meta.env),
});

// initalising the apollo client
const client = new ApolloClient({
  link: apolloTransport,
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
