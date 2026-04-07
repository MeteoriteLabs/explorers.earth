import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import StaticPageLayout from "../components/StaticPageLayout";
import { usePlatformTerms } from "../features/LandingPage/hooks/usePlatformTerms";
import RichTextContent from "../features/LandingPage/components/RichTextContent";
import { LoadingSpinner } from "../features/LandingPage/components/LoadingSpinner";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";

export default function Terms() {
  const { t } = useTranslation();
  const { terms, loading, error } = usePlatformTerms();

  // Scroll to top immediately when component loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <>
      <SEO
        title="Terms & Conditions - explorers Service Agreement & User Terms"
        description="Read explorers's terms and conditions for using our QR code platform. Understand your rights and responsibilities when creating and sharing local recommendations through our service."
        keywords={[
          "explorers terms conditions",
          "service agreement",
          "user terms",
          "terms of service",
          "legal terms",
          "user agreement",
          "platform rules",
          "service terms",
          "usage terms",
          "legal agreement",
        ]}
        canonical={createCanonicalUrl("/terms")}
        type="website"
        noIndex={false}
        enableGEO={true}
        geoData={createWebPageGEOData({
          pageType: 'terms',
          title: 'Terms & Conditions | explorers',
          description: 'explorers terms and conditions outlining the service agreement, user rights, and responsibilities for using the QR code recommendation platform.',
          keywords: ['terms of service', 'user agreement', 'service terms', 'legal terms'],
          purpose: 'Review the terms and conditions governing use of the explorers platform and services',
        })}
      />

      <StaticPageLayout title={t("legal.terms.title")}>
        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <LoadingSpinner />
            <span className="ml-3 text-gray-600">
              {t("legal.terms.loading")}
            </span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">
            {t("legal.terms.error")}
          </div>
        ) : (
          <RichTextContent content={terms} />
        )}
      </StaticPageLayout>
    </>
  );
}
