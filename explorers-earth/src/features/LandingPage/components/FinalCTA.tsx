import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { UsernameClaimInput } from "./UsernameClaimInput";

export default function FinalCTA() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_26%_20%,rgba(216,161,93,.34),transparent_30%),linear-gradient(135deg,#102513,#1b3b1a)] py-20 text-center text-white sm:py-24 lg:py-28">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mx-auto max-w-4xl"
        >
          <h2 className="landing-display mx-auto max-w-4xl text-3xl font-bold leading-[0.98] sm:text-5xl lg:text-6xl">
            {t("sections.finalCTA.headline")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-xl">
            {t("sections.finalCTA.subtext")}
          </p>

          <UsernameClaimInput
            username={username}
            setUsername={setUsername}
            className="mx-auto mt-8 max-w-[610px] text-left"
          />
        </motion.div>
      </div>
    </section>
  );
}
