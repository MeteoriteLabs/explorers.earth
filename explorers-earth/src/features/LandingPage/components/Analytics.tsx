import { motion } from "framer-motion";
import { BarChart3, Eye, MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";

const insightCards = [
  {
    icon: BarChart3,
    titleKey: "sections.analytics.workingTitle",
    descKey: "sections.analytics.workingDesc",
  },
  {
    icon: MousePointerClick,
    titleKey: "sections.analytics.scanningTitle",
    descKey: "sections.analytics.scanningDesc",
  },
  {
    icon: Eye,
    titleKey: "sections.analytics.spotsTitle",
    descKey: "sections.analytics.spotsDesc",
  },
] as const;

export default function Analytics() {
  const { t } = useTranslation();

  return (
    <section className="landing-section relative overflow-hidden bg-[#102513] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(184,201,171,.18),transparent_34%),radial-gradient(circle_at_12%_76%,rgba(200,121,65,.13),transparent_28%)]" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-xl"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            {t("sections.analytics.headline")}
          </h2>
          <p className="mt-5 text-base leading-7 text-white/68 sm:text-lg">
            {t("sections.analytics.subtext")}
          </p>

          <div className="mt-8 grid gap-4">
            {insightCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <motion.div
                  key={card.titleKey}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.12 }}
                  viewport={{ once: true }}
                  className="flex gap-4 rounded-[22px] border border-white/10 bg-white/[0.07] p-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dce9ce] text-[#143d32]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <h3 className="font-bold text-white">{t(card.titleKey)}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/58">{t(card.descKey)}</p>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          viewport={{ once: true }}
          className="relative z-10 rounded-[28px] border border-white/10 bg-[#17351c] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.22)]"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white">{t("sections.analytics.dashboardTitle")}</h3>
              <p className="text-sm text-white/60">{t("sections.analytics.last30Days")}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/78">
              {t("sections.analytics.livePreview")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "1,247", label: t("sections.analytics.totalScans") },
              { value: "84%", label: t("sections.analytics.engagement") },
              { value: "23", label: t("sections.analytics.referrals") },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/10 p-4 text-center">
                <div className="text-xl font-bold text-white sm:text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-5">
            <div className="flex h-48 items-end justify-between gap-3">
              {[52, 72, 46, 86, 68, 94, 62, 78].map((height, index) => (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${height}%` }}
                  transition={{ delay: 0.25 + index * 0.06, duration: 0.45 }}
                  viewport={{ once: true }}
                  className="w-full rounded-t-xl bg-gradient-to-t from-[#c87941] to-[#b8c9ab]"
                  style={{ minHeight: 10 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
