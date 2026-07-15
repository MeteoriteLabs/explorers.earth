import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, BookOpen, MapPin, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import Footer from "../features/LandingPage/components/Footer";
import LandingHeader from "../features/LandingPage/components/LandingHeader";
import { ExplorerMapBackground } from "../features/LandingPage/components/BackgroundPatterns";
import useAuthStore from "../store/store";
import { createWebPageGEOData } from "../utils/geoHelpers";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export default function About() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const motionProps = reducedMotion
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        variants: reveal,
        transition: { duration: 0.65, ease: "easeOut" as const },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden">
      <SEO
        title={t("about.seo.title")}
        description={t("about.seo.description")}
        keywords={t("about.seo.keywords", { returnObjects: true }) as string[]}
        canonical={createCanonicalUrl("/about")}
        type="website"
        enableGEO
        geoData={createWebPageGEOData({
          pageType: "about",
          title: t("about.seo.title"),
          description: t("about.seo.description"),
          keywords: t("about.seo.keywords", { returnObjects: true }) as string[],
          purpose: t("about.seo.purpose"),
        })}
      />
      <LandingHeader />

      <main>
        <section className="relative flex min-h-[720px] items-center overflow-hidden bg-[var(--landing-cream)] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
          <ExplorerMapBackground />
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.75 }}
            className="relative z-10 mx-auto max-w-4xl text-center"
          >
            <p className="mb-5 text-xs font-black uppercase tracking-[0.24em] text-[#c87941]">
              {t("about.heroEyebrow")}
            </p>
            <h1 className="landing-display text-5xl font-bold leading-[0.98] text-[#17231a] sm:text-6xl lg:text-8xl">
              {t("about.title")}
            </h1>
            <div className="mx-auto mt-8 max-w-2xl space-y-2 text-lg leading-8 text-[#52604f] sm:text-xl">
              <p>{t("about.subtitle.line1")}</p>
              <p>{t("about.subtitle.line2")}</p>
              <p className="font-bold text-[#1b3b1a]">{t("about.subtitle.line3")}</p>
            </div>
            <a
              href="#what-we-believe"
              className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#17231a]/15 bg-[#fffcf6]/80 px-5 py-3 font-bold text-[#1b3b1a] shadow-sm backdrop-blur transition-colors hover:bg-white visited:text-[#375c3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87941] focus-visible:ring-offset-4"
            >
              {t("about.readBeliefs")}
              <ArrowDown size={17} aria-hidden="true" />
            </a>
          </motion.div>
        </section>

        <section id="what-we-believe" className="scroll-mt-28 bg-[#fffcf6] px-4 py-24 sm:px-6 lg:py-32">
          <motion.div {...motionProps} className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c87941]">{t("about.section1.title")}</p>
            <div className="landing-display mt-8 space-y-3 text-3xl font-semibold leading-tight text-[#17231a] sm:text-4xl">
              <p>{t("about.section1.line1")}</p>
              <p>{t("about.section1.line2")}</p>
              <p>{t("about.section1.line3")}</p>
            </div>
            <p className="mx-auto mt-10 max-w-2xl whitespace-pre-line text-lg leading-8 text-[#66715f]">
              {t("about.section1.line4")}
            </p>
          </motion.div>
        </section>

        <section className="relative overflow-hidden bg-[#102513] px-4 py-24 text-white sm:px-6 lg:py-32">
          <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(#b8c9ab_1px,transparent_1px)] [background-size:26px_26px]" />
          <motion.div {...motionProps} className="relative mx-auto max-w-4xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8a15d]">{t("about.section2.title")}</p>
            <div className="landing-display mt-8 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              <p>{t("about.section2.line1")}</p>
              <p className="mt-2 text-[#dce9ce]">{t("about.section2.line2")}</p>
            </div>
            <p className="mx-auto mt-9 max-w-2xl whitespace-pre-line text-lg leading-8 text-white/72">
              {t("about.section2.line3")}
            </p>
          </motion.div>
        </section>

        <section className="bg-[var(--landing-cream)] px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div {...motionProps}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c87941]">{t("about.section3.title")}</p>
              <h2 className="landing-display mt-6 text-4xl font-bold text-[#17231a] sm:text-5xl">
                {t("about.section3.line1")}
              </h2>
              <ul className="mt-8 space-y-5 text-lg leading-8 text-[#52604f]">
                {["item1", "item2", "item3"].map((key) => (
                  <li key={key} className="flex gap-4">
                    <span aria-hidden="true" className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#c87941]" />
                    {t(`about.section3.${key}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-9 space-y-1 font-bold text-[#1b3b1a]">
                <p>{t("about.section3.line2")}</p>
                <p>{t("about.section3.line3")}</p>
              </div>
            </motion.div>

            <motion.div {...motionProps} className="relative mx-auto w-full max-w-xl" role="img" aria-label={t("about.productVisualAlt")}>
              <div className="absolute -inset-8 rounded-full bg-[#dce9ce]/55 blur-3xl" aria-hidden="true" />
              <div className="relative grid grid-cols-2 gap-4 rounded-[32px] border border-[#17231a]/10 bg-[#fffcf6]/80 p-5 shadow-[0_24px_80px_rgba(27,59,26,.14)]">
                <img src="/landing/profile-1.png" alt="" width="420" height="420" className="aspect-square w-full rounded-[22px] object-cover object-top" />
                <div className="space-y-4 pt-8" aria-hidden="true">
                  <div className="rounded-[20px] bg-[#1b3b1a] p-5 text-[#f6f1e7]">
                    <MapPin className="mb-8" size={22} />
                    <span className="block h-2 w-3/4 rounded bg-white/35" />
                    <span className="mt-2 block h-2 w-1/2 rounded bg-white/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <span className="grid aspect-square place-items-center rounded-2xl bg-[#eadfcf] text-[#c87941]"><BookOpen size={22} /></span>
                    <span className="grid aspect-square place-items-center rounded-2xl bg-[#dce9ce] text-[#1b3b1a]"><Sparkles size={22} /></span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-[#fffcf6] px-4 py-24 sm:px-6 lg:py-32">
          <motion.div {...motionProps} className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c87941]">{t("about.section4.title")}</p>
            <div className="landing-display mt-8 space-y-3 text-4xl font-bold leading-tight text-[#17231a] sm:text-5xl">
              <p>{t("about.section4.line1")}</p>
              <p>{t("about.section4.line2")}</p>
            </div>
            <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line text-lg leading-8 text-[#66715f]">
              {t("about.section4.line3")}
            </p>
          </motion.div>
        </section>

        <section className="relative overflow-hidden bg-[#eadfcf] px-4 py-24 sm:px-6 lg:py-32">
          <motion.div {...motionProps} className="relative mx-auto max-w-4xl text-center">
            <p className="landing-display whitespace-pre-line text-4xl font-bold leading-tight text-[#17231a] sm:text-5xl lg:text-6xl">
              {t("about.closing")}
            </p>
            <button
              onClick={() => navigate(isAuthenticated ? "/home" : "/register")}
              className="landing-green-button mt-10 inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3.5 font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87941] focus-visible:ring-offset-4"
            >
              {t("about.join")}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
