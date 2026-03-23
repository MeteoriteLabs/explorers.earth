import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import StaticPageLayout from "../components/StaticPageLayout";
import { usePlatformTerms } from "../features/LandingPage/hooks/usePlatformTerms";
import RichTextContent from "../features/LandingPage/components/RichTextContent";
import { LoadingSpinner } from "../features/LandingPage/components/LoadingSpinner";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";

export default function Privacy() {
  const { t } = useTranslation();
  const { privacy, loading, error } = usePlatformTerms();

  // Scroll to top immediately when component loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <>
      <SEO
        title="Privacy Policy – explorers | Data Protection & User Privacy Commitment"
        description="Read explorers's Privacy Policy to understand how we protect your personal data and ensure your privacy. Learn about our data collection, usage, storage, and security practices on our location-based platform."
        keywords={[
          "explorers privacy policy",
          "data protection policy",
          "user privacy rights",
          "personal data security",
          "privacy compliance explorers",
          "data collection practices",
          "user information protection",
          "privacy terms and conditions",
          "GDPR compliance",
          "CCPA compliance",
          "secure data handling",
          "location sharing privacy",
          "privacy policy travel app",
          "data privacy statement",
          "user data protection policy",
          "user privacy",
          "privacy rights",
          "data collection",
          "personal information",
          "data security",
          "user data protection",
          "privacy terms",
        ]}
        canonical={createCanonicalUrl("/privacy")}
        type="website"
        noIndex={false}
        enableGEO={true}
        geoData={createWebPageGEOData({
          pageType: 'privacy',
          title: 'Privacy Policy | explorers',
          description: 'explorers privacy policy detailing how user data is collected, stored, and protected on our location-based recommendation platform.',
          keywords: ['privacy policy', 'data protection', 'user privacy', 'GDPR', 'CCPA'],
          purpose: 'Understand how explorers collects, uses, and protects your personal data and privacy rights',
        })}
      />

      <StaticPageLayout title={t("legal.privacy.title")}>
        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <LoadingSpinner />
            <span className="ml-3 text-gray-600">
              {t("legal.privacy.loading")}
            </span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">
            {t("legal.privacy.error")}
          </div>
        ) : (
          <RichTextContent content={privacy} />
        )}
      </StaticPageLayout>
    </>
  );
}
