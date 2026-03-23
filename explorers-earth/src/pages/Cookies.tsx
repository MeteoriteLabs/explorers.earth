import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import StaticPageLayout from "../components/StaticPageLayout";
import { usePlatformTerms } from "../features/LandingPage/hooks/usePlatformTerms";
import RichTextContent from "../features/LandingPage/components/RichTextContent";
import { LoadingSpinner } from "../features/LandingPage/components/LoadingSpinner";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";

export default function Cookies() {
  const { t } = useTranslation();
  const { cookies, loading, error } = usePlatformTerms();

  // Scroll to top immediately when component loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <>
      <SEO
        title="Cookie Policy - explorers Cookie Usage & Web Tracking Information"
        description="Learn about explorers's cookie policy and how we use cookies to improve your experience. Understand what data we collect and how to manage your cookie preferences."
        keywords={[
          "explorers cookie policy",
          "cookies usage",
          "web tracking",
          "cookie preferences",
          "data tracking",
          "website cookies",
          "privacy cookies",
          "cookie consent",
          "tracking policy",
          "cookie management",
        ]}
        canonical={createCanonicalUrl("/cookies")}
        type="website"
        noIndex={false}
        enableGEO={true}
        geoData={createWebPageGEOData({
          pageType: 'cookies',
          title: 'Cookie Policy | explorers',
          description: 'explorers cookie policy explaining how cookies are used to enhance the user experience and what tracking data is collected.',
          keywords: ['cookie policy', 'cookies', 'web tracking', 'cookie preferences', 'cookie consent'],
          purpose: 'Understand how explorers uses cookies and manage your cookie preferences',
        })}
      />

      <StaticPageLayout title={t("legal.cookies.title")}>
        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <LoadingSpinner />
            <span className="ml-3 text-gray-600">
              {t("legal.cookies.loading")}
            </span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">
            {t("legal.cookies.error")}
          </div>
        ) : (
          <RichTextContent content={cookies} />
        )}
      </StaticPageLayout>
    </>
  );
}
