import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock component simulating category tab switcher
const TabSwitcher = ({ onTabChange }: { onTabChange: (tab: string) => void }) => {
  const tabs = ['Movies', 'Books', 'Games', 'Music', 'Products', 'Apps', 'People', 'Locations', 'Guides'];
  const [active, setActive] = useState('Movies');
  
  return (
    <div>
      <div role="tablist">
        {tabs.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={active === t}
            onClick={() => { setActive(t); onTabChange(t); }}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel">Active category: {active}</div>
    </div>
  );
};

describe('Category Tab Switching integration', () => {
  it('renders all 9 tabs and updates active state on click', () => {
    const handleTabChange = vi.fn();
    render(<TabSwitcher onTabChange={handleTabChange} />);
    
    // Check all 9 tabs exist
    const tabs = ['Movies', 'Books', 'Games', 'Music', 'Products', 'Apps', 'People', 'Locations', 'Guides'];
    tabs.forEach(tabName => {
      expect(screen.getByRole('tab', { name: tabName })).toBeInTheDocument();
    });

    // Click Books tab
    const booksTab = screen.getByRole('tab', { name: 'Books' });
    fireEvent.click(booksTab);

    expect(handleTabChange).toHaveBeenCalledWith('Books');
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movies' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Active category: Books')).toBeInTheDocument();
  });
});
