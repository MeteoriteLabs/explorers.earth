import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useFaqs } from "../hooks/useFaqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export default function FAQ() {
  const { t } = useTranslation();
  const { faqs, loading, error } = useFaqs();

  if (loading) {
    return (
      <section
        id="faq"
        className="py-12 sm:py-16 lg:py-20 w-full min-w-0"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
          <div className="text-center">
            <p>{t("sections.faq.loading")}</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="faq"
        className="py-12 sm:py-16 lg:py-20 w-full min-w-0"
        style={{ backgroundColor: "#F3F4F6" }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0">
          <div className="text-center">
            <p>{t("sections.faq.error")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="faq"
      className="py-12 sm:py-16 lg:py-20 w-full min-w-0"
      style={{ backgroundColor: "#F3F4F6" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full min-w-0 w-full" style={{ overflow: "visible" }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-4 sm:mb-6 leading-tight">
            {t("sections.faq.headline")}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            {t("sections.faq.subtext")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto w-full min-w-0"
        >
          <Accordion type="multiple" className="space-y-4 w-full min-w-0">
            {faqs.map((item, index) => (
              <motion.div
                key={item.Sequence}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <AccordionItem
                  value={item.Sequence.toString()}
                  className="bg-white rounded-xl shadow-sm border-none px-0"
                >
                  <AccordionTrigger className="px-4 sm:px-6 py-4 text-left font-semibold text-charcoal hover:bg-gray-50 rounded-xl hover:no-underline break-words min-w-0">
                    {item.Question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-6 pb-4 text-gray-600 break-words overflow-x-hidden">
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
