import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsProvider } from "./hooks/use-analytics";
import AnalyticsTracker from "@/components/analytics-tracker";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import PlaylistPage from "@/pages/playlist-page";
import LandingPage from "@/pages/landing-page";
import DashboardPage from "@/pages/dashboard-page";
import SettingsPage from "@/pages/settings-page";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminSEOPage from "@/pages/admin-seo";
import UserDetailPage from "@/pages/user-detail-page";
import AnalyticsTest from "@/pages/analytics-test";
import TermsPage from "@/pages/terms-page";
import PrivacyPage from "@/pages/privacy-page";
import VerificationSentPage from "@/pages/verification-sent-page";
import VerifyEmailPage from "@/pages/verify-email-page";
import { ProtectedRoute } from "./lib/protected-route";
import Header from "@/components/header";
import { useEffect } from "react";
import { checkSSOAuth, clearSSOAuth } from "./lib/authStorage";

// Define public routes that don't need authentication
const PUBLIC_ROUTES = ['/', '/auth', '/playlist', '/analytics-test', '/terms', '/privacy', '/verify-email'];

function Router() {
  const [location] = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.startsWith(route));

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/playlist/:guestUrl" component={PlaylistPage} />
      <Route path="/analytics-test" component={AnalyticsTest} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      
      {/* Email verification routes */}
      <Route path="/verification-sent">
        {() => (
          <ProtectedRoute 
            path="/verification-sent" 
            component={VerificationSentPage} 
            requireAdmin={false}
          />
        )}
      </Route>

      {/* Admin routes */}
      <Route path="/admin/dashboard">
        {() => (
          <ProtectedRoute 
            path="/admin/dashboard" 
            component={AdminDashboard} 
            requireAdmin={true}
          />
        )}
      </Route>
      <Route path="/admin/seo">
        {() => (
          <ProtectedRoute 
            path="/admin/seo" 
            component={AdminSEOPage} 
            requireAdmin={true}
          />
        )}
      </Route>
      <Route path="/admin/users/:userId">
        {() => (
          <ProtectedRoute 
            path="/admin/users/:userId" 
            component={UserDetailPage} 
            requireAdmin={true}
          />
        )}
      </Route>

      {/* Regular user routes */}
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute 
            path="/dashboard" 
            component={DashboardPage} 
            requireAdmin={false}
          />
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <ProtectedRoute 
            path="/settings" 
            component={SettingsPage} 
            requireAdmin={false}
          />
        )}
      </Route>

      {/* 404 route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.startsWith(route));

  // Initialize CSRF token on app start
  useEffect(() => {
    const initializeCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token', {
          credentials: 'include',
          mode: 'cors'
        });
        if (response.ok) {
          console.log('CSRF token initialized');
        }
      } catch (error) {
        console.warn('Failed to initialize CSRF token:', error);
      }
    };

    initializeCsrfToken();
  }, []);

  // Listen for SSO authentication messages
  useEffect(() => {
    const handleSSOMessage = (event: MessageEvent) => {
      if (event.data.type === 'LOCALTUNES_SSO_SUCCESS') {
        console.log('🎉 SSO authentication successful in React app!');
        
        // Check for SSO authentication data
        const ssoUser = checkSSOAuth();
        if (ssoUser) {
          console.log('✅ SSO user authenticated, refreshing page to update state');
          // Force a page refresh to update the authentication state
          window.location.reload();
        }
      }
    };

    window.addEventListener('message', handleSSOMessage);
    
    return () => {
      window.removeEventListener('message', handleSSOMessage);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider>
        <AuthProvider skipAuthCheck={isPublicRoute}>
          <ThemeProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 pt-16">
                <Router />
              </main>
            </div>
            <Toaster />
            <AnalyticsTracker />
          </ThemeProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </QueryClientProvider>
  );
}

export default App;
