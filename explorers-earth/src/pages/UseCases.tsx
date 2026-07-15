import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Layers3, Link2, Plus, QrCode, Share2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import Footer from "../features/LandingPage/components/Footer";
import LandingHeader from "../features/LandingPage/components/LandingHeader";
import useAuthStore from "../store/store";
import { createWebPageGEOData } from "../utils/geoHelpers";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const perspectives = ["personal", "creators", "brands"] as const;
const journeySteps = [
  { key: "collect", icon: Plus },
  { key: "shape", icon: Layers3 },
  { key: "share", icon: Share2 },
] as const;

function HeroTriptych({ alt }: { alt: string }) {
  const images = [
    { src: "/landing/Paris.jpg", position: "object-center" },
    { src: "/landing/profile-1.png", position: "object-top" },
    { src: "/landing/storefront-1.png", position: "object-center" },
  ] as const;

  return (
    <div role="img" aria-label={alt} className="relative mx-auto mt-12 max-w-3xl">
      <svg aria-hidden="true" className="absolute inset-x-[12%] top-1/2 hidden h-16 w-3/4 -translate-y-1/2 text-[#c87941]/45 lg:block" viewBox="0 0 600 80" fill="none">
        <path d="M10 44 C130 2 220 76 300 40 C385 2 462 72 590 32" stroke="currentColor" strokeWidth="2" strokeDasharray="7 9" />
      </svg>
      <div className="relative grid grid-cols-3 items-center gap-3 sm:gap-5 lg:gap-0">
        {images.map((image, index) => (
          <div
            key={image.src}
            className={`relative aspect-square overflow-hidden rounded-full border-[5px] border-[#fffcf6] bg-[#eadfcf] shadow-[0_20px_55px_rgba(27,59,26,.16)] lg:w-[260px] ${
              index === 0 ? "lg:justify-self-start" : index === 1 ? "lg:z-10 lg:scale-110 lg:justify-self-center" : "lg:justify-self-end"
            }`}
          >
            <img
              src={image.src}
              alt=""
              width="520"
              height="520"
              loading={index === 1 ? "eager" : "lazy"}
              decoding={index === 1 ? "sync" : "async"}
              className={`h-full w-full object-cover ${image.position}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PerspectiveVisual({ perspective }: { perspective: (typeof perspectives)[number] }) {
  if (perspective === "personal") {
    return (
      <div className="grid grid-cols-[1.2fr_.8fr] gap-3 rounded-[30px] bg-[#f6f1e7] p-4" aria-hidden="true">
        <img src="/landing/Kyoto.jpg" alt="" width="520" height="520" loading="lazy" decoding="async" className="aspect-[4/5] h-full w-full rounded-[22px] object-cover" />
        <div className="space-y-3 pt-8">
          {["w-3/4", "w-1/2", "w-4/5", "w-2/3"].map((width, index) => (
            <div key={index} className="rounded-2xl bg-white px-3 py-5 shadow-sm">
              <span className={`mx-auto block h-2 rounded-full bg-[#1b3b1a]/35 ${width}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (perspective === "creators") {
    return (
      <div className="relative rounded-[30px] bg-[#dce9ce] p-7" aria-hidden="true">
        <div className="mx-auto max-w-[290px] rounded-[28px] border-8 border-[#17231a] bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-[#c87941]" />
            <span className="h-3 w-24 rounded-full bg-[#eadfcf]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <span className="aspect-square rounded-2xl bg-[#f6f1e7]" />
            <span className="aspect-square rounded-2xl bg-[#1b3b1a]" />
            <span className="aspect-square rounded-2xl bg-[#d8a15d]" />
            <span className="aspect-square rounded-2xl bg-[#eadfcf]" />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f6f1e7] px-4 py-3">
            <Link2 size={18} />
            <QrCode size={22} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-[30px] bg-[#eadfcf] p-4" aria-hidden="true">
      <img src="/landing/storefront-2.png" alt="" width="520" height="520" loading="lazy" decoding="async" className="aspect-square w-full rounded-[22px] object-cover" />
      <img src="/landing/products-flatlay.jpg" alt="" width="520" height="520" loading="lazy" decoding="async" className="aspect-square w-full rounded-[22px] object-cover" />
      <div className="col-span-2 rounded-[22px] bg-[#102513] p-5 text-[#f6f1e7]">
        <span className="mb-8 block h-2 w-20 rounded-full bg-[#d8a15d]" />
        <span className="block h-3 w-3/4 rounded-full bg-white/35" />
        <span className="mt-2 block h-3 w-1/2 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

export default function UseCases() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const reveal = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.65, ease: "easeOut" as const },
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden">
      <SEO
        title={t("useCases.seo.title")}
        description={t("useCases.seo.description")}
        keywords={t("useCases.seo.keywords", { returnObjects: true }) as string[]}
        canonical={createCanonicalUrl("/use-cases")}
        image={createCanonicalUrl("/landing/profile-1.png")}
        type="website"
        enableGEO
        geoData={createWebPageGEOData({
          pageType: "use-cases",
          title: t("useCases.seo.title"),
          description: t("useCases.seo.description"),
          keywords: t("useCases.seo.keywords", { returnObjects: true }) as string[],
          purpose: t("useCases.seo.purpose"),
        })}
      />
      <LandingHeader />

      <main>
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#dce9ce_0%,transparent_38%),linear-gradient(#f6f1e7,#fffcf6)] px-4 pb-24 pt-36 sm:px-6 lg:pb-32">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.75 }}
            className="mx-auto max-w-5xl text-center"
          >
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8c4d22]">{t("useCases.hero.eyebrow")}</p>
            <h1 className="landing-display mx-auto mt-5 max-w-4xl text-5xl font-bold leading-[1.02] text-[#17231a] sm:text-6xl lg:text-7xl">
              {t("useCases.hero.title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#66715f] sm:text-xl">{t("useCases.hero.description")}</p>

            <nav aria-label={t("useCases.hero.chooseLabel")} className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="w-full text-xs font-black uppercase tracking-[0.18em] text-[#66715f]">{t("useCases.hero.chooseLabel")}</span>
              {perspectives.map((perspective) => (
                <a key={perspective} href={`#${perspective}`} className="inline-flex min-h-11 items-center rounded-full border border-[#17231a]/14 bg-white/70 px-5 py-2 font-bold text-[#1b3b1a] transition-colors hover:border-[#c87941] hover:text-[#c87941] visited:text-[#375c3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87941] focus-visible:ring-offset-4">
                  {t(`useCases.perspectives.${perspective}.label`)}
                </a>
              ))}
            </nav>

            <HeroTriptych alt={t("useCases.hero.visualAlt")} />
          </motion.div>
        </section>

        {perspectives.map((perspective, index) => (
          <section
            key={perspective}
            id={perspective}
            className={`scroll-mt-28 px-4 py-24 sm:px-6 lg:py-32 ${index % 2 ? "bg-[#f6f1e7]" : "bg-[#fffcf6]"}`}
          >
            <div className={`mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center ${index % 2 ? "" : "lg:[&>div:first-child]:order-2"}`}>
              <motion.div {...reveal} className="mx-auto w-full max-w-lg">
                <PerspectiveVisual perspective={perspective} />
              </motion.div>
              <motion.div {...reveal} className="max-w-xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c4d22]">{t(`useCases.perspectives.${perspective}.label`)}</p>
                <h2 className="landing-display mt-6 text-4xl font-bold leading-tight text-[#17231a] sm:text-5xl">{t(`useCases.perspectives.${perspective}.title`)}</h2>
                <p className="mt-6 text-lg leading-8 text-[#66715f]">{t(`useCases.perspectives.${perspective}.description`)}</p>
                <ul className="mt-8 space-y-4">
                  {[0, 1, 2].map((itemIndex) => (
                    <li key={itemIndex} className="flex gap-4 leading-7 text-[#52604f]">
                      <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#c87941]" />
                      {t(`useCases.perspectives.${perspective}.points.${itemIndex}`)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>
        ))}

        <section className="bg-[#102513] px-4 py-24 text-white sm:px-6 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8a15d]">{t("useCases.journey.eyebrow")}</p>
              <h2 className="landing-display mt-5 text-4xl font-bold sm:text-5xl">{t("useCases.journey.title")}</h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/68">{t("useCases.journey.description")}</p>
            </motion.div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {journeySteps.map(({ key, icon: Icon }, index) => (
                <motion.div {...reveal} key={key} className="border-t border-white/15 pt-7">
                  <div className="flex items-center justify-between">
                    <Icon className="text-[#d8a15d]" size={26} aria-hidden="true" />
                    <span className="landing-display text-3xl font-bold text-white/20">0{index + 1}</span>
                  </div>
                  <h3 className="landing-display mt-8 text-3xl font-bold">{t(`useCases.journey.steps.${key}.title`)}</h3>
                  <p className="mt-4 leading-7 text-white/65">{t(`useCases.journey.steps.${key}.description`)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eadfcf] px-4 py-24 sm:px-6 lg:py-32">
          <motion.div {...reveal} className="mx-auto max-w-4xl text-center">
            <h2 className="landing-display text-4xl font-bold leading-tight text-[#17231a] sm:text-5xl lg:text-6xl">{t("useCases.cta.title")}</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#66715f]">{t("useCases.cta.description")}</p>
            <button onClick={() => navigate(isAuthenticated ? "/home" : "/register")} className="landing-green-button mt-9 inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3.5 font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87941] focus-visible:ring-offset-4">
              {t("useCases.cta.button")}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
