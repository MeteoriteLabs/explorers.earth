import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, Gamepad2, MapPin, Music, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExplorerMapBackground } from "./BackgroundPatterns";
import { UsernameClaimInput } from "./UsernameClaimInput";

const FALLBACK_WORDS = [
  "recommendations",
  "curations",
  "collections",
  "favorites",
];

const PREVIEW_ITEMS = [
  { icon: MapPin, label: "Kyoto ramen", metaKey: "hero.preview.items.place" },
  { icon: BookOpen, label: "Rich Dad Poor Dad", metaKey: "hero.preview.items.book" },
  { icon: Music, label: "Taylor Swift", metaKey: "hero.preview.items.music" },
  { icon: Gamepad2, label: "GTA V", metaKey: "hero.preview.items.game" },
] as const;

const GLOBAL_COUNTRIES = [
  { code: "in", labelKey: "hero.countries.in" },
  { code: "us", labelKey: "hero.countries.us" },
  { code: "gb", labelKey: "hero.countries.gb" },
  { code: "jp", labelKey: "hero.countries.jp" },
  { code: "fr", labelKey: "hero.countries.fr" },
  { code: "au", labelKey: "hero.countries.au" },
  { code: "br", labelKey: "hero.countries.br" },
  { code: "ae", labelKey: "hero.countries.ae" },
  { code: "sg", labelKey: "hero.countries.sg" },
  { code: "de", labelKey: "hero.countries.de" },
] as const;

export default function Hero() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;
  const translatedWords = t("hero.rotatingWords", {
    returnObjects: true,
    defaultValue: FALLBACK_WORDS,
  });
  const words = Array.isArray(translatedWords) ? translatedWords : FALLBACK_WORDS;

  useEffect(() => {
    if (noMotion) return;

    const id = window.setInterval(() => {
      setWordIndex((index) => (index + 1) % words.length);
    }, 2200);

    return () => window.clearInterval(id);
  }, [noMotion, words.length]);

  return (
    <section
      id="hero"
      className="relative flex min-h-screen w-full items-center overflow-hidden bg-[radial-gradient(circle_at_50%_16%,rgba(220,233,206,.72),transparent_36%),linear-gradient(180deg,#f3eadc_0%,#f6f1e7_66%,#fffcf6_100%)] pt-24 text-[#17231a] sm:pt-28"
      style={{ scrollMarginTop: "6rem" }}
    >
      <ExplorerMapBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-3 sm:px-6 sm:pb-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto flex max-w-4xl flex-col items-center text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(23,35,26,.14)] bg-white/55 px-4 py-2 text-sm font-extrabold text-[#1b3b1a] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#c87941]" />
            {t("hero.badge")}
          </span>

          <h1 className="landing-display max-w-full text-[2.35rem] font-bold leading-[0.91] sm:text-7xl lg:max-w-5xl lg:text-[6.625rem]">
            <span className="block">{t("hero.headlinePrefix")}</span>
            <span className="relative block min-h-[1em] overflow-hidden text-[#1b3b1a]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={words[wordIndex]}
                  initial={noMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={noMotion ? undefined : { opacity: 0, y: -24 }}
                  transition={{
                    duration: noMotion ? 0 : 0.35,
                    ease: "easeOut",
                  }}
                  className="inline-block"
                >
                  {words[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="block">{t("hero.headlineSuffix")}</span>
          </h1>

          <p className="landing-muted mt-6 max-w-3xl text-base leading-7 sm:text-lg lg:text-[1.35rem] lg:leading-8">
            {t("hero.subtext")}
          </p>

          <UsernameClaimInput
            username={username}
            setUsername={setUsername}
            className="mt-8 w-full max-w-[610px] text-left"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-10 w-full max-w-5xl"
        >
          <div className="landing-card relative grid min-h-[360px] gap-5 overflow-hidden p-4 md:grid-cols-[1fr_minmax(250px,350px)_1fr] md:items-center">
            <div className="hidden rotate-[-3deg] rounded-[24px] border border-white/75 bg-white/90 p-5 text-left shadow-xl md:block">
              <p className="mb-4 text-sm font-black text-[#1b3b1a]">
                {t("hero.preview.todayList")}
              </p>
              {PREVIEW_ITEMS.slice(0, 3).map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="mt-3 grid grid-cols-[42px_1fr] items-center gap-3 rounded-2xl border border-black/5 bg-white p-3"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dce9ce] text-[#1b3b1a]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <strong className="block text-sm">{item.label}</strong>
                      <small className="font-bold text-[#6f6a5f]">
                        {t(item.metaKey)}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>

            <motion.img
              src="/images/recommendations.png"
              alt={t("hero.preview.screenAlt")}
              className="mx-auto h-auto w-full max-w-[360px] object-contain drop-shadow-[0_28px_50px_rgba(23,35,26,0.26)]"
              loading="eager"
              decoding="async"
              animate={{ y: noMotion ? 0 : [0, -8, 0] }}
              transition={{
                duration: noMotion ? 0 : 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            <div className="hidden rotate-[3deg] rounded-[24px] border border-white/75 bg-white/90 p-5 text-left shadow-xl md:block">
              <div className="mb-4 grid h-28 place-items-center rounded-2xl bg-[#dce9ce]">
                <QrCode className="h-16 w-16 text-[#1b3b1a]" />
              </div>
              <p className="text-xl font-black leading-tight">
                {t("hero.preview.onePageTitle")}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#6f6a5f]">
                {t("hero.preview.onePageText")}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="mt-7 w-full max-w-[720px] overflow-hidden text-center">
          <p className="mb-3 text-sm font-extrabold text-[#6f6a5f]">
            {t("hero.globalStrip")}
          </p>
          <div className="relative overflow-hidden">
            <motion.div
              className="flex w-max gap-3"
              animate={noMotion ? undefined : { x: ["0%", "-50%"] }}
              transition={{
                duration: 28,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {[...GLOBAL_COUNTRIES, ...GLOBAL_COUNTRIES].map(
                (country, index) => (
                  <span
                    key={`${country.code}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3.5 py-2 text-sm font-extrabold text-[#1b3b1a] shadow-sm"
                  >
                    <img
                      src={`https://flagcdn.com/w40/${country.code}.png`}
                      srcSet={`https://flagcdn.com/w80/${country.code}.png 2x`}
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-6 rounded-[3px] object-cover shadow-sm"
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{t(country.labelKey)}</span>
                  </span>
                )
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
