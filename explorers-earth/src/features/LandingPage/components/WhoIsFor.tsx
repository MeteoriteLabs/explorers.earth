import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const perspectives = ["personal", "creators", "brands"] as const;

export default function WhoIsFor() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <section id="who-is-for" className="landing-section landing-section-band overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="max-w-3xl"
        >
          <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#c87941]">
            {t("sections.whoIsFor.eyebrow")}
          </p>
          <h2 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl lg:text-5xl">
            {t("sections.whoIsFor.headline")}
          </h2>
          <p className="landing-muted mt-4 max-w-2xl text-base leading-7 sm:text-lg">
            {t("sections.whoIsFor.subtext")}
          </p>
        </motion.div>

        <div className="mt-12 divide-y divide-[#17231a]/12 border-y border-[#17231a]/12">
          {perspectives.map((perspective, index) => (
            <motion.article
              key={perspective}
              initial={reducedMotion ? false : { opacity: 0, x: index % 2 ? 18 : -18 }}
              whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              viewport={{ once: true }}
              className="grid gap-4 py-8 sm:grid-cols-[110px_1fr_auto] sm:items-center sm:gap-8"
            >
              <span className="landing-display text-4xl font-bold text-[#c87941]/70">
                0{index + 1}
              </span>
              <div>
                <h3 className="landing-display text-2xl font-bold text-[#17231a] sm:text-3xl">
                  {t(`sections.whoIsFor.perspectives.${perspective}.title`)}
                </h3>
                <p className="landing-muted mt-2 max-w-2xl leading-7">
                  {t(`sections.whoIsFor.perspectives.${perspective}.description`)}
                </p>
              </div>
              <Link
                to={`/use-cases#${perspective}`}
                className="inline-flex min-h-11 items-center gap-2 justify-self-start font-bold text-[#1b3b1a] underline decoration-[#c87941]/50 underline-offset-8 transition-colors hover:text-[#c87941] visited:text-[#375c3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87941] focus-visible:ring-offset-4"
              >
                {t("sections.whoIsFor.explore")}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
