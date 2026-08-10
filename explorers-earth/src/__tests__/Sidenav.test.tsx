import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/Sidenav';
import { DashboardThemeProvider } from '../contexts/DashboardThemeContext';

describe('Sidebar Navigation Component', () => {
  it('renders exactly 5 core navigation items', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <DashboardThemeProvider>
          <Sidebar />
        </DashboardThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Home/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    expect(screen.queryByText(/^Movies$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Books$/i)).not.toBeInTheDocument();
  });
});
