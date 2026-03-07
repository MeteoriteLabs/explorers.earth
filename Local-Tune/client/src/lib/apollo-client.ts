/**
 * Apollo Client Configuration - LocalQR Auth Model
 * GraphQL client with authentication token handling
 */

import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'https://api.localqr.earth/graphql';
const VITE_PUBLIC_ACCESS_TOKEN = import.meta.env.VITE_PUBLIC_ACCESS_TOKEN || '';

// List of operations that don't need authentication
const PUBLIC_OPERATIONS = [
  'login',
  'register',
  'forgotPassword',
  'resetPassword',
  'CheckUsernameAvailability',
  // Add any other public operations here
];

const httpLink = createHttpLink({
  uri: VITE_API_URL,
});

// Auth link to add JWT token to requests
const authLink = setContext((operation, { headers }) => {
  // Check if this operation should skip authentication
  const operationName = operation.operationName;
  const isPublicOperation = PUBLIC_OPERATIONS.includes(operationName);
  
  if (isPublicOperation) {
    // For public operations, use public token or no token
    return {
      headers: {
        ...headers,
        authorization: VITE_PUBLIC_ACCESS_TOKEN ? `Bearer ${VITE_PUBLIC_ACCESS_TOKEN}` : '',
      },
    };
  }
  
  // Get token from localStorage (same key as LocalQR)
  const token = localStorage.getItem('qrtoken');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : (VITE_PUBLIC_ACCESS_TOKEN ? `Bearer ${VITE_PUBLIC_ACCESS_TOKEN}` : ''),
    },
  };
});

// Error link to handle authentication errors
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED' || extensions?.code === 'FORBIDDEN') {
        // Clear auth data and redirect to login
        localStorage.removeItem('qrtoken');
        localStorage.removeItem('auth-storage');
        window.location.href = '/auth';
      }
    });
  }
  
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
