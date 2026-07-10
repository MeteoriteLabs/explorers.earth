import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock list creation form
const ListCreationForm = ({ onSubmit }: { onSubmit: (data: { name: string; category: string }) => void }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Movies');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('List name required');
      return;
    }
    onSubmit({ name, category });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Create List Form">
      {error && <span role="alert">{error}</span>}
      <label htmlFor="list-name">List Name</label>
      <input id="list-name" value={name} onChange={e => setName(e.target.value)} />
      
      <label htmlFor="list-category">Category</label>
      <select id="list-category" value={category} onChange={e => setCategory(e.target.value)}>
        <option>Movies</option>
        <option>Books</option>
        <option>Games</option>
      </select>

      <button type="submit">Create</button>
    </form>
  );
};

describe('List creation form validation and submission', () => {
  it('shows error on empty submission', () => {
    render(<ListCreationForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert')).toHaveTextContent('List name required');
  });

  it('submits form values successfully', () => {
    const handleSubmit = vi.fn();
    render(<ListCreationForm onSubmit={handleSubmit} />);
    
    fireEvent.change(screen.getByLabelText('List Name'), { target: { value: 'My Summer Reads' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Books' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(handleSubmit).toHaveBeenCalledWith({ name: 'My Summer Reads', category: 'Books' });
  });
});
