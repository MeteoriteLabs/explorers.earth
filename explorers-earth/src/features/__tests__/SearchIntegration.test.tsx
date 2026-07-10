import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';

// Mock component simulating API query rendering on search
const SearchInputIntegration = ({ onSearch }: { onSearch: (query: string) => Promise<string[]> }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = await onSearch(query);
    setResults(data);
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleSearch} aria-label="Search form">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." />
        <button type="submit">Submit</button>
      </form>
      {loading && <p>Loading results...</p>}
      <ul aria-label="results">
        {results.map(r => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
};

describe('Search interface integration', () => {
  it('triggers search callback and lists result items', async () => {
    const mockSearchApi = vi.fn().mockResolvedValue(['Inception', 'Interstellar']);
    render(<SearchInputIntegration onSearch={mockSearchApi} />);

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Nolan' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Search form' }));

    expect(screen.getByText('Loading results...')).toBeInTheDocument();
    expect(mockSearchApi).toHaveBeenCalledWith('Nolan');

    await waitFor(() => {
      expect(screen.queryByText('Loading results...')).not.toBeInTheDocument();
    });

    const list = screen.getByRole('list', { name: 'results' });
    expect(list).toHaveTextContent('Inception');
    expect(list).toHaveTextContent('Interstellar');
  });
});
