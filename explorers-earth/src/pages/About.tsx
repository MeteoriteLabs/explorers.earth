import { motion } from "framer-motion";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import LandingHeader from "../features/LandingPage/components/LandingHeader";
import Footer from "../features/LandingPage/components/Footer";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";

export default function About() {
  const { t } = useTranslation();

  // Scroll to top immediately when component loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <>
      <SEO
        title={t("about.seo.title")}
        description={t("about.seo.description")}
        keywords={
          t("about.seo.keywords", { returnObjects: true }) as string[]
        }
        canonical={createCanonicalUrl("/about")}
        type="website"
        noIndex={false}
        enableGEO={true}
        geoData={createWebPageGEOData({
          pageType: 'about',
          title: 'About | explorers',
          description: 'Learn about explorers, the platform that helps local experts share their favorite places through QR codes and digital links.',
          keywords: ['about explorers', 'local recommendations platform', 'QR code sharing', 'place discovery'],
          purpose: 'Learn about the explorers platform, its mission, and how it connects people with authentic local experiences',
        })}
      />

      <div className="min-h-screen w-full overflow-x-hidden">
        {/* Header */}
        <LandingHeader />

        {/* Hero Section — responsive for mobile; Our Philosophy CTA below */}
        <section className="pt-24 sm:pt-28 lg:pt-36 pb-14 sm:pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'hsl(var(--soft-off-white))' }}>
          <div className="container mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center"
            >
              <h1
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight"
                style={{ color: "hsl(var(--evergreen))" }}
              >
                {t("about.title")}
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-700 mb-4 sm:mb-6 leading-snug font-medium">
                {t("about.subtitle.line1")}
              </p>
              <div className="space-y-2 sm:space-y-3 text-sm sm:text-base md:text-lg text-gray-600 italic max-w-2xl mx-auto leading-snug">
                <p>{t("about.subtitle.line2")}</p>
                <p>{t("about.subtitle.line3")}</p>
              </div>
              {/* Our Philosophy CTA — same theme, below paragraph */}
              <div className="mt-8 sm:mt-10">
                <a
                  href="https://explorersofearth.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full sm:w-auto min-w-[200px] sm:min-w-[280px] px-6 sm:px-8 md:px-10 py-3.5 sm:py-4 md:py-5 text-base sm:text-lg font-semibold text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[hsl(var(--evergreen))]"
                  style={{ backgroundColor: 'hsl(var(--evergreen))' }}
                >
                  <span className="whitespace-nowrap">Our Philosophy</span>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 1 — WHAT WE BELIEVE */}
        <section className="py-12 sm:py-16 lg:py-20" style={{ backgroundColor: 'hsl(var(--warm-beige))' }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="max-w-3xl mx-auto"
            >
              <h2
                className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-center leading-tight"
                style={{ color: "hsl(var(--evergreen))" }}
              >
                {t("about.section1.title")}
              </h2>
              <div className="space-y-4 sm:space-y-5 text-sm sm:text-base md:text-lg text-gray-700 leading-relaxed text-center">
                <p>{t("about.section1.line1")}</p>
                <p>{t("about.section1.line2")}</p>
                <p>{t("about.section1.line3")}</p>
                <p className="pt-6 mt-6 border-t border-gray-300 text-gray-600 leading-relaxed whitespace-pre-line">
                  {t("about.section1.line4")}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 2 — HOW WE SEE EXPLORATION */}
        <section className="py-12 sm:py-16 lg:py-20" style={{ backgroundColor: 'hsl(var(--soft-off-white))' }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="max-w-3xl mx-auto"
            >
              <h2
                className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-center leading-tight"
                style={{ color: "hsl(var(--evergreen))" }}
              >
                {t("about.section2.title")}
              </h2>
              <div className="space-y-4 sm:space-y-5 text-sm sm:text-base md:text-lg text-gray-700 leading-relaxed text-center">
                <p>{t("about.section2.line1")}</p>
                <p>{t("about.section2.line2")}</p>
                <p className="pt-4 text-gray-600 leading-relaxed whitespace-pre-line">
                  {t("about.section2.line3")}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Closing Statement — content left, explorershero image right; responsive */}
        <section className="py-12 sm:py-16 lg:py-20 pb-16 sm:pb-20 lg:pb-24" style={{ backgroundColor: 'hsl(var(--warm-beige))' }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 xl:gap-16 items-center">
              {/* Content — left on desktop, first on mobile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                className="order-1 lg:order-1 text-center lg:text-left"
              >
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl text-gray-700 leading-snug sm:leading-relaxed whitespace-pre-line font-medium">
                  {t("about.closing")}
                </p>
              </motion.div>
              {/* Image card — right; reduced padding, shift right via margin; vertical bounce only */}
              <motion.div
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  type: "spring",
                  stiffness: 340,
                  damping: 14,
                  delay: 0.2,
                }}
                className="order-2 lg:order-2 flex justify-center lg:justify-end py-4 lg:py-5 lg:-ml-2"
              >
                <motion.div
                  className="flex justify-center lg:justify-end"
                  animate={{ y: [0, -14, 0] }}
                  transition={{
                    duration: 4,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                >
                  <img
                    src="/images/explorershero.png"
                    alt="Explorers"
                    className="w-full max-w-[280px] sm:max-w-[300px] lg:max-w-[280px] xl:max-w-[340px] h-auto object-contain rounded-2xl shadow-lg"
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
