import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LandingPhoneScreens } from "./LandingPhoneScreens";

export default function CreateCustomize() {
  const { t } = useTranslation();
  const steps = t("sections.createCustomize.steps", {
    returnObjects: true,
  }) as Array<{ title: string; body: string }>;

  return (
    <section id="how-it-works" className="landing-section overflow-hidden bg-[#f6f1e7]">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl lg:text-5xl">
            {t("sections.createCustomize.headline")}
          </h2>
          <p className="landing-muted mt-4 text-base leading-7 sm:text-lg">
            {t("sections.createCustomize.subtext")}
          </p>
        </motion.div>

        <div className="mt-10 grid gap-7 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative grid min-h-[430px] place-items-center overflow-visible">
            <LandingPhoneScreens />
          </div>

          <div className="grid gap-4">
            {steps.map((step, index) => (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.12 }}
                viewport={{ once: true }}
                className="landing-soft-card p-6"
              >
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-full bg-[#1b3b1a] text-sm font-black text-white">
                  {index + 1}
                </div>
                <h3 className="text-2xl font-black text-[#17231a]">{step.title}</h3>
                <p className="landing-muted mt-3 leading-7">{step.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
