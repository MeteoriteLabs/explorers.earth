import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EarthLoader } from '../components/EarthLoader';
import { decideTunesSso, hardRedirect, stashSsoReturn } from '../utils/tunesSso';

/**
 * /sso/tunes — bridges a logged-in explorers session into localtunes.
 *
 * Strapi allows only one Google callback (explorers), so tunes can't run its
 * own. Instead tunes sends users here; we forward the Strapi JWT (qrtoken) to
 * tunes' /google-auth/callback, which completes login on the tunes side.
 * If the user isn't logged into explorers yet, stash the intent and run the
 * normal explorers login; Login/GoogleAuthRedirect bring them back here.
 */
const TunesSsoRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const action = decideTunesSso(localStorage.getItem('qrtoken'));
    if (action.kind === 'forward') {
      hardRedirect(action.url);
      return;
    }
    stashSsoReturn(Date.now());
    navigate('/login');
  }, [navigate]);

  return (
    <div className="dashboard-theme dashboard-theme-dark bg-dashboard-bg min-h-screen">
      <EarthLoader context="login" statusMessage="Connecting to LocalTunes..." />
    </div>
  );
};

export default TunesSsoRedirect;
