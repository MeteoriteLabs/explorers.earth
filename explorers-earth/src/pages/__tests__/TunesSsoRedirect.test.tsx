import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TunesSsoRedirect from '../TunesSsoRedirect';
import * as tunesSso from '../../utils/tunesSso';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../components/EarthLoader', () => ({ EarthLoader: () => null }));

describe('TunesSsoRedirect', () => {
  beforeEach(() => {
    navigate.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('forwards the JWT to tunes when logged into explorers', () => {
    localStorage.setItem('qrtoken', 'jwt.xyz');
    const spy = vi.spyOn(tunesSso, 'hardRedirect').mockImplementation(() => {});
    render(<MemoryRouter><TunesSsoRedirect /></MemoryRouter>);
    expect(spy).toHaveBeenCalledWith(
      'https://localtunes.earth/google-auth/callback?access_token=jwt.xyz',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stashes intent and routes to login when not logged in', () => {
    const spy = vi.spyOn(tunesSso, 'hardRedirect').mockImplementation(() => {});
    render(<MemoryRouter><TunesSsoRedirect /></MemoryRouter>);
    expect(spy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('post_login_redirect')).toContain('/sso/tunes');
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
