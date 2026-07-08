import { motion, useReducedMotion } from "framer-motion";
import { Building2, Compass, Megaphone, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";

const audienceCards = [
  { icon: Compass, visual: "personal" },
  { icon: Megaphone, visual: "creators" },
  { icon: Building2, visual: "hosts" },
  { icon: UsersRound, visual: "brands" },
] as const;

type AudienceCard = (typeof audienceCards)[number];
type AudienceVisualText = {
  personal: string[];
  creators: string[];
  hostsQr: string;
};

function AudienceVisual({
  card,
  explorerLabel,
  visualText,
}: {
  card: AudienceCard;
  explorerLabel: string;
  visualText: AudienceVisualText;
}) {
  const Icon = card.icon;

  return (
    <div className="mb-5 h-[170px] rounded-[20px] bg-[#f8f2e7] p-4">
      <div className="h-full rounded-[18px] border border-black/5 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dce9ce] text-[#1b3b1a]">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-full bg-[#f6f1e7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7c8b70]">
            {explorerLabel}
          </span>
        </div>

        {card.visual === "personal" && (
          <div className="grid grid-cols-3 gap-2">
            {visualText.personal.map((item) => (
              <span key={item} className="rounded-xl bg-[#f6f1e7] px-2 py-2 text-center text-[11px] font-black text-[#1b3b1a]">
                {item}
              </span>
            ))}
          </div>
        )}

        {card.visual === "creators" && (
          <div className="space-y-2">
            <span className="block h-3 w-3/4 rounded-full bg-[#dce9ce]" />
            <span className="block h-3 w-full rounded-full bg-[#eee3d3]" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {visualText.creators.map((item) => (
                <span key={item} className="grid aspect-square place-items-center rounded-xl bg-[#f6f1e7] text-[10px] font-black text-[#c87941]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {card.visual === "hosts" && (
          <div className="grid grid-cols-[1fr_58px] gap-3">
            <div className="space-y-2">
              <span className="block h-9 rounded-2xl bg-[#f6f1e7]" />
              <span className="block h-9 rounded-2xl bg-[#dce9ce]" />
            </div>
            <div className="grid place-items-center rounded-2xl bg-[#143d32] text-xs font-black text-white">
              {visualText.hostsQr}
            </div>
          </div>
        )}

        {card.visual === "brands" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <span className="h-8 w-8 rounded-full bg-[#c87941]" />
              <span className="h-8 w-8 rounded-full bg-[#d8a15d]" />
              <span className="h-8 w-8 rounded-full bg-[#7c8b70]" />
            </div>
            <span className="block h-3 w-full rounded-full bg-[#dce9ce]" />
            <span className="block h-3 w-2/3 rounded-full bg-[#eee3d3]" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhoIsFor() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;
  const cardTitles = t("sections.whoIsFor.cards", {
    returnObjects: true,
  }) as string[];
  const visualText = t("sections.whoIsFor.visual", {
    returnObjects: true,
  }) as AudienceVisualText;
  const audienceChips = t("sections.whoIsFor.chips", {
    returnObjects: true,
  }) as string[];

  return (
    <section id="who-is-for" className="landing-section landing-section-band overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl lg:text-5xl">
            {t("sections.whoIsFor.headline")}
          </h2>
          <p className="landing-muted mt-4 text-base leading-7 sm:text-lg">
            {t("sections.whoIsFor.subtext")}
          </p>
        </motion.div>

        <div className="-mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {audienceCards.map((card, index) => (
            <motion.article
              key={card.visual}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="landing-soft-card w-[78vw] max-w-[320px] shrink-0 snap-start p-5 lg:w-auto lg:max-w-none"
            >
              <AudienceVisual
                card={card}
                explorerLabel={t("sections.whoIsFor.explorerLabel")}
                visualText={visualText}
              />
              <h3 className="text-xl font-black text-[#17231a]">{cardTitles[index]}</h3>
            </motion.article>
          ))}
        </div>

        <div className="mt-7 overflow-hidden">
          <motion.div
            className="flex w-max gap-2 py-2"
            animate={noMotion ? undefined : { x: ["0%", "-50%"] }}
            transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
          >
            {[...audienceChips, ...audienceChips].map((chip, index) => (
              <span
                key={`${chip}-${index}`}
                className="rounded-full bg-[#e7dcc8] px-3 py-2 text-xs font-black text-[#1b3b1a]"
              >
                {chip}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
