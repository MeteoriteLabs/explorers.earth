/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 * This allows TypeScript to provide proper types for import.meta.env
 */
interface ImportMetaEnv {
  /**
   * Microsoft Clarity Project ID
   * Used for user behavior analytics
   */
  readonly VITE_CLARITY_PROJECT_ID?: string;
  
  /**
   * Base URL of the application
   * Used for constructing absolute URLs
   */
  readonly VITE_BASE_URL?: string;
  
  /**
   * Strapi CMS URL
   * Used for direct GraphQL queries to Strapi
   */
  readonly VITE_STRAPI_URL?: string;
  
  /**
   * Strapi CMS Access Token
   * Used for authenticating GraphQL requests to Strapi
   */
  readonly VITE_STRAPI_ACCESS_TOKEN?: string;
  
  /**
   * Current environment (development, staging, production)
   */
  readonly MODE: string;
  
  /**
   * Whether the app is running in development mode
   */
  readonly DEV: boolean;
}

/**
 * Augments the ImportMeta interface to include Vite-specific properties
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}