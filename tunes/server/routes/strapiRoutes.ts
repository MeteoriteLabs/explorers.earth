import { Express } from 'express';
import { strapiService } from '../services/strapi-service';

/**
 * Registers Strapi-related routes
 */
export function setupStrapiRoutes(app: Express) {
  // Strapi configuration endpoint for client
  app.get('/api/strapi/config', (req, res) => {
    res.json({
      strapiUrl: process.env.STRAPI_URL || 'https://api.localqr.earth',
      accessToken: process.env.STRAPI_ACCESS_TOKEN || '',
    });
  });

  // Debug endpoint to test Strapi connection
  app.get('/api/debug/strapi', async (req, res) => {
    try {
      const config = {
        strapiUrl: process.env.STRAPI_URL || 'NOT SET',
        accessToken: process.env.STRAPI_ACCESS_TOKEN ? 'SET (hidden)' : 'NOT SET',
        isConfigured: !!(process.env.STRAPI_URL && process.env.STRAPI_ACCESS_TOKEN),
      };

      if (!config.isConfigured) {
        return res.json({
          status: 'error',
          message: 'Strapi environment variables not configured',
          config,
        });
      }

      try {
        const testResult = await strapiService.findSongLimitByUsername('test_user_12345');
        res.json({
          status: 'success',
          message: 'Strapi connection is working',
          config: {
            ...config,
            accessToken: 'SET (hidden)',
          },
          testQuery: testResult ? 'Found test record' : 'No test record found (this is normal)',
        });
      } catch (error) {
        res.json({
          status: 'error',
          message: 'Strapi connection failed',
          config,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Debug endpoint error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Strapi GraphQL proxy endpoint
  app.post('/api/strapi/graphql', async (req, res) => {
    try {
      const { query, variables } = req.body;

      if (!query) {
        return res.status(400).json({
          errors: [{ message: 'GraphQL query is required' }],
        });
      }

      const strapiUrl = process.env.STRAPI_URL;
      const accessToken = process.env.STRAPI_ACCESS_TOKEN;

      if (!strapiUrl || !accessToken) {
        return res.status(500).json({
          errors: [{ message: 'Strapi configuration is missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN environment variables.' }],
        });
      }

      const graphqlEndpoint = `${strapiUrl}/graphql`;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Strapi API error response:', errorText);
        return res.status(response.status).json({
          errors: [{ message: `Strapi API error: ${response.status} ${response.statusText}` }],
        });
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL errors:', result.errors);
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Strapi GraphQL proxy error:', error);
      res.status(500).json({
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error occurred' }],
      });
    }
  });
}
