import { memo } from "react";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import AnalyticsDashboard from "../features/Analytics/components/AnalyticsDashboard";

const Analytics = memo(() => {
  return (
    <>
      <SEO
        title="Analytics Dashboard - explorers Performance Insights"
        description="View detailed analytics and performance insights for your explorers codes, track engagement, views, and understand your audience better."
        keywords={[
          'explorers analytics',
          'QR code analytics',
          'performance insights',
          'engagement tracking',
          'analytics dashboard',
          'QR code metrics',
          'user analytics',
          'performance data',
          'recommendation analytics'
        ]}
        canonical={createCanonicalUrl("/analytics")}
        type="website"
        noIndex={true}
      />
      
      <AnalyticsDashboard />
    </>
  );
});

export default Analytics;
