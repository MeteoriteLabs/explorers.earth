import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAnalytics, AnalyticsEventCategory, AnalyticsEventAction } from '@/hooks/use-analytics';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsTest() {
  const { trackEvent, trackPageView } = useAnalytics();
  const [gtag, setGtag] = useState<any>(null);
  const [gaId, setGaId] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    // Try to get GA ID from meta tags or window
    const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
    setGaId(measurementId || 'Not found');

    // Check if gtag is loaded
    setGtag(window.gtag);

    // Track this page view
    trackPageView('/analytics-test', 'Analytics Test Page');
  }, [trackPageView]);

  const testEvent = () => {
    try {
      trackEvent({
        category: AnalyticsEventCategory.FEATURE,
        action: AnalyticsEventAction.FEATURE_USE,
        label: 'Analytics Test Button Click',
        value: 1,
      });
      
      setTestStatus('success');
      setTestMessage('Event tracked successfully! Check Google Analytics debug view or real-time events.');
    } catch (error) {
      setTestStatus('error');
      setTestMessage(`Error tracking event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Google Analytics Test</CardTitle>
          <CardDescription>
            Test if Google Analytics is properly installed and working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium">Measurement ID:</div>
            <div className="text-sm">{gaId}</div>
            
            <div className="text-sm font-medium">gtag loaded:</div>
            <div className="text-sm">{gtag ? '✅ Yes' : '❌ No'}</div>
            
            <div className="text-sm font-medium">Script in DOM:</div>
            <div className="text-sm">
              {document.querySelector('script[src*="googletagmanager.com/gtag/js"]') 
                ? '✅ Yes' 
                : '❌ No'}
            </div>
          </div>

          {testStatus !== 'pending' && (
            <div className={`mt-4 p-3 rounded text-sm ${testStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {testMessage}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={testEvent} className="w-full">
            Test Analytics Event
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}