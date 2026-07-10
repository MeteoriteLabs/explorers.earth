import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AddPersonPage from '../components/dashboard/AddPersonPage';
import { PEOPLE_BY_LIST, PERSON_CATEGORIES } from '../api/query';
import { CREATE_RECOMMENDED_PERSON } from '../api/mutation';

// Mock auth store
vi.mock('../../../../store/store', () => ({
  default: () => ({
    user: { username: 'testuser' },
    token: 'mock-token',
  }),
}));

// Mock axios to handle direct/proxy image downloads and S3 uploads
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: new Blob(['dummy'], { type: 'image/png' }) });
      }),
      post: vi.fn().mockResolvedValue({
        data: [{ url: 'https://explorers-earth-s3.s3.amazonaws.com/avatar.png' }]
      })
    }
  };
});

describe('People Profile Scrape Flow Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrapes profile URL, renders form preview, and submits to create person successfully', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    // 1. Mock the scrape Profile API endpoint using global fetch
    const mockProfileScrape = {
      full_name: 'Scraped John Doe',
      handle: 'johndoe',
      headline: 'Tech Innovator',
      bio: 'A passionate developer and builder.',
      avatar_url: 'https://example.com/avatar.png',
      location: 'San Francisco, CA',
      follower_count: '10K',
      platform: 'linkedin',
      screenshots: ['https://example.com/screen.png'],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProfileScrape,
    });

    // 2. Setup GraphQL mocks
    const personCategoriesMock = {
      request: {
        query: PERSON_CATEGORIES,
      },
      result: {
        data: {
          peopleCategories: [
            { documentId: 'cat_engineer', Category_name: 'Engineers' }
          ]
        }
      }
    };

    const peopleByListMock = {
      request: {
        query: PEOPLE_BY_LIST,
        variables: {
          personListDocumentId: 'list_123',
          page: 0,
          pageSize: 200
        }
      },
      result: {
        data: {
          personLists: [
            {
              documentId: 'list_123',
              List_Name: 'My Tech People',
              slug: 'my-tech-people',
              Visibility: false,
              display_order: 0,
              recommended_people: []
            }
          ]
        }
      }
    };

    const createPersonMock = {
      request: {
        query: CREATE_RECOMMENDED_PERSON,
        variables: {
          name: 'Scraped John Doe',
          username_handle: 'johndoe',
          headline: 'Tech Innovator',
          location: 'San Francisco, CA',
          avatar_path: 'https://explorers-earth-s3.s3.amazonaws.com/avatar.png',
          primary_platform: 'linkedin',
          social_urls: {
            primary: 'https://linkedin.com/in/johndoe',
            linkedin: 'https://linkedin.com/in/johndoe'
          },
          skills_tags: ['Engineers'],
          user_recommendation_note: null,
          user_rating: null,
          is_pinned: false,
          pin_order: null,
          display_order: 0,
          person_list: 'list_123',
          people_category: 'cat_engineer',
          media_details: {
            imageDetails: [
              { id: 'scraped_1234567890_0', url: 'https://explorers-earth-s3.s3.amazonaws.com/avatar.png' }
            ],
            bio: 'A passionate developer and builder.',
            follower_count: '10K'
          }
        }
      },
      result: {
        data: {
          createRecommendedPerson: {
            __typename: 'RecommendedPerson',
            documentId: 'new_person_123',
            name: 'Scraped John Doe',
            display_order: 0,
            is_pinned: false,
            people_category: {
              __typename: 'PeopleCategory',
              documentId: 'cat_engineer',
              Category_name: 'Engineers'
            }
          }
        }
      }
    };

    // Render the page
    render(
      <MockedProvider mocks={[personCategoriesMock, peopleByListMock, createPersonMock]} addTypename={false}>
        <MemoryRouter initialEntries={['/recommendations/people/list_123/add']}>
          <Routes>
            <Route path="/recommendations/people/:listId/add" element={<AddPersonPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    );

    // Input Profile URL
    const urlInput = screen.getByPlaceholderText(/instagram.com\/username or linkedin/);
    fireEvent.change(urlInput, { target: { value: 'https://linkedin.com/in/johndoe' } });

    // Click fetch to start scraping
    const fetchBtn = screen.getByRole('button', { name: 'Fetch' });
    fireEvent.click(fetchBtn);

    // Verify it transitioned to the details form showing mock scrape results
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. John Doe')).toHaveValue('Scraped John Doe');
      expect(screen.getByPlaceholderText('username')).toHaveValue('johndoe');
      expect(screen.getByPlaceholderText('e.g. Tech Entrepreneur · Speaker')).toHaveValue('Tech Innovator');
      expect(screen.getByPlaceholderText('Short bio or description')).toHaveValue('A passionate developer and builder.');
    });

    // Select category 'Engineers' from the select dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cat_engineer' } });

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: 'Add to List' });
    fireEvent.click(saveBtn);

    // Wait until query/mutations resolve
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add to List' })).not.toBeInTheDocument();
    });
  });
});
