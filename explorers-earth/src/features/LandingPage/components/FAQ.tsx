import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useFaqs } from "../hooks/useFaqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

type FaqItem = {
  Sequence: number;
  Question: string;
  Answer: string;
};

export default function FAQ() {
  const { t } = useTranslation();
  const { faqs, loading, error } = useFaqs();
  const fallbackFaqs = t("sections.faq.fallbackItems", {
    returnObjects: true,
  }) as FaqItem[];

  if (loading) {
    return (
      <section
        id="faq"
        className="landing-section landing-section-band w-full min-w-0"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
          <div className="text-center">
            <p>{t("sections.faq.loading")}</p>
          </div>
        </div>
      </section>
    );
  }

  const visibleFaqs = error || faqs.length === 0 ? fallbackFaqs : faqs;

  return (
    <section
      id="faq"
      className="landing-section landing-section-band w-full min-w-0"
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8" style={{ overflow: "visible" }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl lg:text-5xl">
            {t("sections.faq.headline")}
          </h2>
          <p className="landing-muted mx-auto mt-4 max-w-3xl text-base leading-7 sm:text-lg">
            {t("sections.faq.subtext")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mx-auto w-full max-w-3xl min-w-0"
        >
          <Accordion type="multiple" className="space-y-4 w-full min-w-0">
            {visibleFaqs.map((item, index) => (
              <motion.div
                key={item.Sequence}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <AccordionItem
                  value={item.Sequence.toString()}
                  className="rounded-2xl border border-[rgba(23,35,26,.14)] bg-white/70 px-0 shadow-sm"
                >
                  <AccordionTrigger className="min-w-0 rounded-2xl px-4 py-4 text-left font-bold text-[#17231a] hover:bg-[#fffcf6] hover:no-underline sm:px-6">
                    {item.Question}
                  </AccordionTrigger>
                  <AccordionContent className="landing-muted break-words px-4 pb-4 sm:px-6">
                    {item.Answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
