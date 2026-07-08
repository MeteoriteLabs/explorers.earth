import { motion } from "framer-motion";
import { BookOpen, Link, MessageCircle, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TravelPathPattern } from "./BackgroundPatterns";

const journeyCards = [
  {
    image: "/landing/profile-1.png",
    imageAlt: "/landing/profile-2.png",
    visual: "bio",
    icon: Link,
  },
  {
    image: "/landing/QR-code.png",
    visual: "qr",
    icon: QrCode,
  },
  {
    image: "",
    visual: "messages",
    icon: MessageCircle,
  },
  {
    image: "",
    visual: "guide",
    icon: BookOpen,
  },
] as const;

type JourneyCard = (typeof journeyCards)[number];
type JourneyCardContent = { title: string; eyebrow: string };
type JourneyVisualText = {
  scanForPicks: string;
  messageBubble: string;
  welcomeGuide: string;
  guideItems: string[];
  savedRecommendation: string;
};

function JourneyVisual({ card, visualText }: { card: JourneyCard; visualText: JourneyVisualText }) {
  if (card.visual === "bio") {
    return (
      <div className="relative h-48 overflow-hidden rounded-[18px] bg-[#dce9ce]">
        <img
          src={card.image}
          alt=""
          className="absolute left-4 top-4 h-[168px] w-[120px] rotate-[-5deg] rounded-[18px] object-cover shadow-xl"
          loading="lazy"
          decoding="async"
        />
        <img
          src={card.imageAlt}
          alt=""
          className="absolute right-4 top-4 h-[168px] w-[120px] rotate-[5deg] rounded-[18px] object-cover shadow-xl"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (card.visual === "qr") {
    return (
      <div className="grid h-48 place-items-center rounded-[18px] bg-[#f3eadc] p-5">
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-xl">
          <img
            src={card.image}
            alt=""
            className="h-28 w-28 object-contain"
            loading="lazy"
            decoding="async"
          />
          <span className="mt-3 block text-center text-xs font-black text-[#1b3b1a]">
            {visualText.scanForPicks}
          </span>
        </div>
      </div>
    );
  }

  if (card.visual === "messages") {
    return (
      <div className="h-48 rounded-[18px] bg-[#e7efdc] p-4">
        <div className="mx-auto h-full max-w-[210px] rounded-[24px] border border-black/5 bg-white p-4 shadow-xl">
          <div className="mb-4 flex gap-2">
            <span className="h-7 w-7 rounded-full bg-[#c87941]" />
            <span className="mt-2 h-3 w-20 rounded-full bg-[#e7dcc8]" />
          </div>
          <div className="ml-auto mb-3 w-28 rounded-2xl rounded-tr-sm bg-[#143d32] p-3 text-[10px] font-bold leading-4 text-white">
            {visualText.messageBubble}
          </div>
          <div className="rounded-2xl border border-black/5 bg-[#f8f2e7] p-3">
            <span className="block h-3 w-24 rounded-full bg-[#7c8b70]" />
            <span className="mt-2 block h-2 w-32 rounded-full bg-[#d8d0c0]" />
            <span className="mt-2 block h-2 w-20 rounded-full bg-[#d8d0c0]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-journey-visual="guide"
      className="h-48 overflow-hidden rounded-[18px] bg-[#f8f2e7] p-3"
    >
      <div className="h-full overflow-hidden rounded-[24px] border border-black/5 bg-white p-3 shadow-xl">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-black text-[#1b3b1a]">{visualText.welcomeGuide}</span>
          <QrCode className="h-4 w-4 text-[#c87941]" />
        </div>
        {visualText.guideItems.map((item, index) => (
          <div
            key={item}
            className={`grid grid-cols-[26px_1fr] items-center gap-2 rounded-2xl bg-[#f6f1e7] p-1 ${
              index === 2 ? "" : "mb-1.5"
            }`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-xl bg-[#dce9ce] text-[10px] font-black text-[#1b3b1a]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[11px] text-[#17231a]">{item}</strong>
              <small className="block truncate text-[9px] font-bold text-[#7a7568]">
                {visualText.savedRecommendation}
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShareAnywhere() {
  const { t } = useTranslation();
  const cards = t("sections.shareAnywhere.cards", {
    returnObjects: true,
  }) as JourneyCardContent[];
  const visualText = t("sections.shareAnywhere.visual", {
    returnObjects: true,
  }) as JourneyVisualText;

  return (
    <section id="share" className="landing-section landing-section-band relative overflow-hidden text-[#17231a]">
      <div className="floating-background">
        <TravelPathPattern />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {t("sections.shareAnywhere.headline")}
          </h2>
        </motion.div>

        <div className="-mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {journeyCards.map((card, index) => {
            const Icon = card.icon;
            const content = cards[index];

            return (
              <motion.article
                key={content.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="landing-soft-card w-[78vw] max-w-[320px] shrink-0 snap-start p-4 lg:w-auto lg:max-w-none"
              >
                <JourneyVisual card={card} visualText={visualText} />
                <div className="pt-5">
                  <Icon className="mb-4 h-6 w-6 text-[#1b3b1a]" />
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#c87941]">
                    {content.eyebrow}
                  </p>
                  <h3 className="text-xl font-black">{content.title}</h3>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
