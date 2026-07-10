import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';

// Mock component simulating url scraper page logic
const UrlScrapePanelIntegration = ({ scrapeEndpoint }: { scrapeEndpoint: string }) => {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScrape = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(scrapeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!resp.ok) throw new Error('Scrape failed');
      const json = await resp.json();
      setData(json);
    } catch {
      setError('Scrape failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter URL" />
      <button onClick={handleScrape} disabled={loading}>Scrape</button>
      {loading && <p>Scraping...</p>}
      {error && <p role="alert">{error}</p>}
      {data && <p aria-label="scraped-title">Title: {data.title}</p>}
    </div>
  );
};

describe('Link Scraper mock endpoint Integration', () => {
  it('updates form when link scrapes successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Mock Scraped Page Title' })
    } as Response);

    render(<UrlScrapePanelIntegration scrapeEndpoint="/api/products/scrape-link" />);

    fireEvent.change(screen.getByPlaceholderText('Enter URL'), { target: { value: 'https://amazon.com/item' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scrape' }));

    expect(screen.getByText('Scraping...')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/products/scrape-link', expect.any(Object));

    await waitFor(() => {
      expect(screen.queryByText('Scraping...')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('scraped-title')).toHaveTextContent('Mock Scraped Page Title');
  });

  it('renders failure alert on scrape failures', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    } as Response);

    render(<UrlScrapePanelIntegration scrapeEndpoint="/api/apps/scrape-url" />);

    fireEvent.change(screen.getByPlaceholderText('Enter URL'), { target: { value: 'https://play.google.com/app' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scrape' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Scrape failed');
    });
  });
});
