import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import AddAppPage from '../components/dashboard/AddAppPage';
import { APPS_BY_LIST, APP_CATEGORIES } from '../api/query';
import { CREATE_RECOMMENDED_APP } from '../api/mutation';

// Mock auth store
vi.mock('../../../../store/store', () => ({
  default: () => ({
    user: { username: 'testuser' },
    token: 'mock-token',
  }),
}));

// Mock axios: the submit flow downloads the scraped logo (axios.get) and
// uploads it to S3 via the REST API (axios.post) BEFORE firing the GraphQL
// mutation. Unmocked, those calls hit the real network and stall the test.
vi.mock('axios');
const UPLOADED_LOGO_URL = 'https://s3.example.com/uploads/logo.png';

describe('Apps & Tools Scrape Flow Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 30s test timeout: the scrape -> upload -> mutate -> refetch chain outruns
  // vitest's 5s default on slow CI runners under coverage instrumentation.
  it('scrapes app URL, renders form preview, and submits to create app successfully', { timeout: 30000 }, async () => {
    // 1. Mock the scrape Link API endpoint using global fetch
    const mockAppScrape = {
      title: 'Scraped Figma',
      developer: 'Figma Inc.',
      description: 'Collaborative interface design tool.',
      logo_url: 'https://example.com/logo.png',
      platforms: ['Web', 'macOS', 'Windows'],
      price_tier: 'Freemium',
      download_url: 'https://figma.com/download',
      screenshots: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAppScrape,
    });

    // Logo download → blob; S3 upload → uploaded URL
    (axios.get as any).mockResolvedValue({
      data: new Blob(['fake-image'], { type: 'image/png' }),
    });
    (axios.post as any).mockResolvedValue({
      data: [{ url: UPLOADED_LOGO_URL }],
    });

    // 2. Setup GraphQL mocks
    const appCategoriesMock = {
      request: {
        query: APP_CATEGORIES,
      },
      result: {
        data: {
          appCategories: [
            { documentId: 'cat_design', name: 'Design' }
          ]
        }
      }
    };

    const appsByListMock = {
      request: {
        query: APPS_BY_LIST,
        variables: {
          appListDocumentId: 'list_123',
          page: 0,
          pageSize: 200
        }
      },
      result: {
        data: {
          appLists: [
            {
              documentId: 'list_123',
              List_Name: 'My Apps Stack',
              slug: 'my-apps-stack',
              Visibility: false,
              display_order: 0,
              recommended_apps: []
            }
          ]
        }
      }
    };

    const createAppMock = {
      request: {
        query: CREATE_RECOMMENDED_APP,
        variables: {
          app_url: 'https://figma.com',
          title: 'Scraped Figma',
          description: 'Collaborative interface design tool.',
          logo_url: UPLOADED_LOGO_URL,
          developer: 'Figma Inc.',
          platforms: ['Web', 'macOS', 'Windows'],
          price_tier: 'Freemium',
          download_url: 'https://figma.com/download',
          screenshots: [],
          user_recommendation_note: null,
          user_rating: null,
          is_pinned: false,
          pin_order: null,
          display_order: 0,
          app_list: 'list_123',
          app_category: 'cat_design',
        }
      },
      result: {
        data: {
          createRecommendedApp: {
            __typename: 'RecommendedApp',
            documentId: 'new_app_123',
            title: 'Scraped Figma',
            display_order: 0,
            is_pinned: false
          }
        }
      }
    };

    // Render the page. appsByListMock appears twice: once for the initial page
    // load and once for the post-mutation refetch (each mock is consumed once).
    render(
      <MockedProvider mocks={[appCategoriesMock, appsByListMock, createAppMock, appsByListMock]} addTypename={false}>
        <MemoryRouter initialEntries={['/recommendations/apps/list_123/add']}>
          <Routes>
            <Route path="/recommendations/apps/:listId/add" element={<AddAppPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    );

    // Initial state: choose method
    const urlBtn = screen.getByRole('button', { name: /Add via URL/ });
    expect(urlBtn).toBeInTheDocument();
    fireEvent.click(urlBtn);

    // Input App URL
    const urlInput = screen.getByPlaceholderText(/figma.com or App Store/);
    fireEvent.change(urlInput, { target: { value: 'https://figma.com' } });

    // Click fetch to start scraping
    const fetchBtn = screen.getByRole('button', { name: 'Fetch' });
    fireEvent.click(fetchBtn);

    // Verify it transitioned to the details form showing mock scrape results
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Figma')).toHaveValue('Scraped Figma');
      expect(screen.getByPlaceholderText('Figma Inc.')).toHaveValue('Figma Inc.');
      expect(screen.getByPlaceholderText('https://apps.apple.com/...')).toHaveValue('https://figma.com/download');
    });

    // Select category 'Design'
    const catBtn = screen.getByRole('button', { name: 'Design' });
    fireEvent.click(catBtn);

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: 'Add to List' });
    fireEvent.click(saveBtn);

    // Wait until query/mutations resolve. Generous timeout: the upload →
    // mutation → refetch chain exceeds the 1s default on slow CI runners
    // under coverage instrumentation.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add to List' })).not.toBeInTheDocument();
    }, { timeout: 15000 });
  });
});
