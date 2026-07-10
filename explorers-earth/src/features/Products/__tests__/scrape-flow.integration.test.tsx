import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AddProductPage from '../components/dashboard/AddProductPage';
import { PRODUCTS_BY_LIST, PRODUCT_CATEGORIES } from '../api/query';
import { CREATE_RECOMMENDED_PRODUCT } from '../api/mutation';

// Mock auth store
vi.mock('../../../../store/store', () => ({
  default: () => ({
    user: { username: 'testuser' },
    token: 'mock-token',
  }),
}));

// Mock axios to prevent actual uploads
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: new Blob(['dummy'], { type: 'image/png' }) });
      }),
      post: vi.fn().mockResolvedValue({
        data: [{ url: 'https://explorers-earth-s3.s3.amazonaws.com/logo.png' }]
      })
    }
  };
});

describe('Products Scrape Flow Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 30s test timeout: the scrape -> upload -> mutate -> refetch chain outruns
  // vitest's 5s default on slow CI runners under coverage instrumentation.
  it('scrapes product URL, renders form preview, and submits to create product successfully', { timeout: 30000 }, async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    // 1. Mock the scrape Link API endpoint using global fetch
    const mockProductScrape = {
      title: 'Scraped Keychron K2',
      brand: 'Keychron',
      price: 79.99,
      currency: 'USD',
      logo_url: 'https://example.com/logo.png',
      description: 'A great mechanical keyboard.',
      buy_url: 'https://amazon.com/dp/1234',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProductScrape,
    });

    // 2. Setup GraphQL mocks
    const productCategoriesMock = {
      request: {
        query: PRODUCT_CATEGORIES,
      },
      result: {
        data: {
          productCategories: [
            { documentId: 'cat_kb', name: 'Keyboards' }
          ]
        }
      }
    };

    const productsByListMock = {
      request: {
        query: PRODUCTS_BY_LIST,
        variables: {
          productListDocumentId: 'list_123',
          page: 0,
          pageSize: 200
        }
      },
      result: {
        data: {
          productLists: [
            {
              documentId: 'list_123',
              List_Name: 'My Keyboards',
              slug: 'my-keyboards',
              Visibility: false,
              display_order: 0,
              recommended_products: []
            }
          ]
        }
      }
    };

    const createProductMock = {
      request: {
        query: CREATE_RECOMMENDED_PRODUCT,
        variables: {
          product_url: 'https://amazon.com/dp/1234',
          title: 'Scraped Keychron K2',
          brand: 'Keychron',
          price: 79.99,
          currency: 'USD',
          buy_url: 'https://amazon.com/dp/1234',
          logo_url: 'https://explorers-earth-s3.s3.amazonaws.com/logo.png',
          description: 'A great mechanical keyboard.',
          specifications: {},
          images: [],
          user_recommendation_note: null,
          user_rating: null,
          is_pinned: false,
          pin_order: null,
          display_order: 0,
          product_list: 'list_123',
          product_category: 'cat_kb',
        }
      },
      result: {
        data: {
          createRecommendedProduct: {
            __typename: 'RecommendedProduct',
            documentId: 'new_prod_123',
            title: 'Scraped Keychron K2'
          }
        }
      }
    };

    // Render the actual page using Router mapping
    render(
      <MockedProvider mocks={[productCategoriesMock, productsByListMock, createProductMock]} addTypename={false}>
        <MemoryRouter initialEntries={['/recommendations/products/list_123/add']}>
          <Routes>
            <Route path="/recommendations/products/:listId/add" element={<AddProductPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    );

    // Initial state: input product URL
    const urlInput = screen.getByPlaceholderText(/amazon.com/);
    fireEvent.change(urlInput, { target: { value: 'https://amazon.com/dp/1234' } });

    // Click fetch to start scraping
    const fetchBtn = screen.getByRole('button', { name: 'Fetch' });
    fireEvent.click(fetchBtn);

    // Verify it transitioned to the details form showing mock scrape results
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Product name')).toHaveValue('Scraped Keychron K2');
      expect(screen.getByPlaceholderText('e.g. Keychron, Sony')).toHaveValue('Keychron');
      expect(screen.getByPlaceholderText('79.99')).toHaveValue(79.99);
    });

    // Select category 'Keyboards'
    const catBtn = screen.getByRole('button', { name: 'Keyboards' });
    fireEvent.click(catBtn);

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: 'Add to List' });
    fireEvent.click(saveBtn);

    // Wait until product list query/mutations resolve. Generous timeout: the
    // chain exceeds the 1s default on slow CI runners under coverage.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add to List' })).not.toBeInTheDocument();
    }, { timeout: 15000 });
  });
});
