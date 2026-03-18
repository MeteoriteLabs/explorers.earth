import { motion } from "framer-motion";
import { useEffect } from "react";
import { Mail, Globe, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import LandingHeader from "../features/LandingPage/components/LandingHeader";
import Footer from "../features/LandingPage/components/Footer";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";

// Decorative background pattern components
const CompassIcon = () => (
  <svg
    className="absolute top-20 right-10 w-32 h-32 text-gray-200 opacity-20 pointer-events-none"
    viewBox="0 0 100 100"
    fill="currentColor"
  >
    <circle
      cx="50"
      cy="50"
      r="45"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <circle cx="50" cy="50" r="3" fill="currentColor" />
    <path d="M50 5 L55 45 L50 50 L45 45 Z" fill="currentColor" />
    <path d="M95 50 L55 55 L50 50 L55 45 Z" fill="currentColor" />
    <path d="M50 95 L45 55 L50 50 L55 55 Z" fill="currentColor" />
    <path d="M5 50 L45 45 L50 50 L45 55 Z" fill="currentColor" />
  </svg>
);

const WorldMapSilhouette = () => (
  <svg
    className="absolute bottom-20 left-10 w-40 h-24 text-gray-200 opacity-15 pointer-events-none"
    viewBox="0 0 200 120"
    fill="currentColor"
  >
    {/* Simplified world map outline */}
    <path d="M20 40 Q30 35 40 40 L50 45 Q60 40 70 45 L80 50 Q90 45 100 50 L110 55 Q120 50 130 55 L140 60 Q150 55 160 60 L170 65 Q180 60 190 65 L190 80 Q180 85 170 80 L160 75 Q150 80 140 75 L130 70 Q120 75 110 70 L100 65 Q90 70 80 65 L70 60 Q60 65 50 60 L40 55 Q30 60 20 55 Z" />
  </svg>
);

const TravelPath = () => (
  <svg
    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-gray-200 opacity-10 pointer-events-none"
    viewBox="0 0 200 200"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      d="M20 20 Q60 40 100 20 T180 40 Q170 80 140 100 T80 160 Q40 140 20 100 T20 20"
      strokeDasharray="5,5"
    />
    <circle cx="20" cy="20" r="3" fill="currentColor" />
    <circle cx="100" cy="20" r="3" fill="currentColor" />
    <circle cx="180" cy="40" r="3" fill="currentColor" />
    <circle cx="140" cy="100" r="3" fill="currentColor" />
    <circle cx="80" cy="160" r="3" fill="currentColor" />
  </svg>
);

export default function Contact() {
  const { t } = useTranslation();

  // Scroll to top immediately when component loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return (
    <>
      <SEO
        title={t("contact.seo.title")}
        description={t("contact.seo.description")}
        keywords={
          t("contact.seo.keywords", { returnObjects: true }) as string[]
        }
        canonical={createCanonicalUrl("/contact")}
        type="website"
        noIndex={false}
        enableGEO={true}
        geoData={createWebPageGEOData({
          pageType: 'contact',
          title: 'Contact | explorers',
          description: 'Get in touch with the explorers team for support, feedback, or partnership inquiries.',
          keywords: ['contact explorers', 'support', 'get in touch', 'customer service'],
          purpose: 'Reach out to the explorers team for questions, support, or collaboration opportunities',
        })}
      />

      <div
        className="min-h-screen"
        style={{ backgroundColor: "hsl(var(--warm-beige))" }}
      >
        {/* Header */}
        <LandingHeader />

        {/* Decorative Background Elements */}
        <CompassIcon />
        <WorldMapSilhouette />
        <TravelPath />

        {/* Header/Hero Section */}
        <section className="pt-24 sm:pt-28 lg:pt-32 pb-12 sm:pb-16 lg:pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-4xl mx-auto"
            >
              <h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 leading-tight"
                style={{ color: "hsl(var(--evergreen))" }}
              >
                {t("contact.title")}
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                {t("contact.subtitle")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Contact Info Card */}
        <section className="pb-12 sm:pb-16 lg:pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 sm:p-10 lg:p-12 text-center">
                <div className="mb-6">
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                    style={{ backgroundColor: "hsl(var(--evergreen))" }}
                  >
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h2
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ color: "hsl(var(--evergreen))" }}
                  >
                    {t("contact.getInTouch")}
                  </h2>

                  <div className="py-4">
                    <a
                      href={`mailto:${t("contact.email")}`}
                      className="inline-flex items-center gap-3 text-xl sm:text-2xl font-semibold text-gray-800 hover:opacity-75 transition-opacity"
                    >
                      <Globe
                        className="w-6 h-6"
                        style={{ color: "hsl(var(--evergreen))" }}
                      />
                      {t("contact.email")}
                    </a>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <MessageCircle className="w-4 h-4" />
                    <span>{t("contact.responseTime")}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Closing Message */}
        <section className="pb-16 sm:pb-20 lg:pb-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 sm:p-8 lg:p-10 border border-white/30">
                <p className="text-base sm:text-lg md:text-xl text-gray-700 leading-relaxed">
                  {t("contact.closingMessage")}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
