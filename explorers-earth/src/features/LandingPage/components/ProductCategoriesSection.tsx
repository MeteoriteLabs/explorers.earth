import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AppWindow,
  BookOpen,
  Clapperboard,
  Gamepad2,
  MapPin,
  Music,
  Package,
  UserRound,
} from "lucide-react";

const categoryMeta = {
  places: {
    image: "/landing/Kyoto.jpg",
    visual: "image",
    icon: MapPin,
    color: "bg-[#2f6b55]",
  },
  people: {
    image: "/landing/marco_polo.jpg",
    visual: "image",
    icon: UserRound,
    color: "bg-[#d86f3c]",
  },
  books: {
    image: "/landing/Rich_Dad.jpg",
    visual: "image",
    icon: BookOpen,
    color: "bg-[#735f3f]",
  },
  movies: {
    image: "/landing/Interstellar.jpg",
    visual: "image",
    icon: Clapperboard,
    color: "bg-[#33415c]",
  },
  games: {
    image: "/landing/GTA.jpg",
    visual: "image",
    icon: Gamepad2,
    color: "bg-[#6a8a3a]",
  },
  music: {
    image: "/landing/Taylor_Swift_Music.jpg",
    visual: "image",
    icon: Music,
    color: "bg-[#b75c7a]",
  },
  products: {
    image: "/landing/products-flatlay.jpg",
    visual: "products",
    icon: Package,
    color: "bg-[#b9812d]",
  },
  apps: {
    image: "/landing/apps-tools-workspace.jpg",
    visual: "apps",
    icon: AppWindow,
    color: "bg-[#285d6d]",
  },
} as const;

type CategoryId = keyof typeof categoryMeta;
type CategoryContent = {
  id: CategoryId;
  label: string;
  title: string;
  description: string;
};
type Category = CategoryContent & (typeof categoryMeta)[CategoryId];
type VisualLabels = { products: string; apps: string };
type VisualDetails = { products: string[]; apps: string[] };

function CategoryVisual({
  category,
  visualLabels,
  visualDetails,
}: {
  category: Category;
  visualLabels: VisualLabels;
  visualDetails: VisualDetails;
}) {
  if (category.visual === "products" || category.visual === "apps") {
    const details = visualDetails[category.visual];

    return (
      <div
        data-category-visual={category.visual}
        className="relative h-full min-h-[240px] overflow-hidden rounded-[22px] shadow-2xl"
      >
        <img
          src={category.image}
          alt=""
          className="h-full min-h-[240px] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/45 bg-white/90 p-3 text-[#17231a] shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2f6b55]">
            {visualLabels[category.visual]}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {details.map((detail) => (
              <span
                key={detail}
                className="rounded-full bg-[#f3eadc] px-2.5 py-1 text-[11px] font-black text-[#1b3b1a]"
              >
                {detail}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={category.image}
      alt=""
      className="h-full min-h-[240px] w-full rounded-[22px] object-cover shadow-2xl"
      loading="lazy"
      decoding="async"
    />
  );
}

function CategoryPreview({
  category,
  noMotion,
  actions,
  overlayLabel,
  visualLabels,
  visualDetails,
}: {
  category: Category;
  noMotion: boolean;
  actions: string[];
  overlayLabel: string;
  visualLabels: VisualLabels;
  visualDetails: VisualDetails;
}) {
  const Icon = category.icon;

  return (
    <motion.div
      key={category.id}
      initial={noMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: noMotion ? 0 : 0.35 }}
      className="landing-card grid min-h-[420px] overflow-hidden lg:grid-cols-[1fr_0.9fr]"
    >
      <div className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <span className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white ${category.color}`}>
            <Icon className="h-6 w-6" />
          </span>
          <h3 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl">
            {category.title}
          </h3>
          <p className="landing-muted mt-4 max-w-xl text-base leading-7">
            {category.description}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {actions.map((action) => (
            <span
              key={action}
              className="rounded-full border border-[#2f6b55]/15 bg-[#f6f1e7] px-3.5 py-2 text-sm font-semibold text-[#2f6b55]"
            >
              {action}
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-h-[240px] bg-[#143d32] p-4 sm:p-5">
        <CategoryVisual
          category={category}
          visualLabels={visualLabels}
          visualDetails={visualDetails}
        />
        <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/20 bg-white/90 p-4 text-charcoal shadow-lg backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6b55]">
            {overlayLabel}
          </p>
          <p className="mt-1 text-lg font-bold">{category.label}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProductCategoriesSection() {
  const { t } = useTranslation();
  const translatedCategories = t("sections.productCategories.categories", {
    returnObjects: true,
  }) as CategoryContent[];
  const categories = translatedCategories
    .filter((category) => category.id in categoryMeta)
    .map((category) => ({
      ...category,
      ...categoryMeta[category.id],
    })) as Category[];
  const actions = t("sections.productCategories.actions", {
    returnObjects: true,
  }) as string[];
  const visualLabels = t("sections.productCategories.visualLabels", {
    returnObjects: true,
  }) as VisualLabels;
  const visualDetails = t("sections.productCategories.visualDetails", {
    returnObjects: true,
  }) as VisualDetails;
  const [activeId, setActiveId] = useState<CategoryId>("places");
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;
  const activeCategory = categories.find((category) => category.id === activeId) ?? categories[0];

  return (
    <section id="product" className="landing-section landing-section-band">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="landing-display text-3xl font-bold leading-tight text-[#17231a] sm:text-4xl lg:text-5xl">
            {t("sections.productCategories.headline")}
          </h2>
          <p className="landing-muted mt-4 text-base leading-7 sm:text-lg">
            {t("sections.productCategories.subtext")}
          </p>
        </div>

        <div className="mt-10">
          <motion.div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
            initial={noMotion ? false : { x: 0 }}
            whileInView={noMotion ? undefined : { x: [0, -18, 0] }}
            transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            {categories.map((category) => {
              const isActive = category.id === activeId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveId(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-[#143d32] text-white"
                      : "border border-black/10 bg-white text-charcoal"
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="hidden gap-2 lg:grid">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = category.id === activeId;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveId(category.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                      isActive
                        ? "border-[#143d32] bg-[#143d32] text-white shadow-lg"
                        : "border-black/5 bg-white text-charcoal hover:border-[#2f6b55]/30"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isActive ? "bg-white/15 text-white" : "bg-[#f6f1e7] text-[#2f6b55]"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold">{category.label}</span>
                  </button>
                );
              })}
            </div>

            <CategoryPreview
              category={activeCategory}
              noMotion={noMotion}
              actions={actions}
              overlayLabel={t("sections.productCategories.overlayLabel")}
              visualLabels={visualLabels}
              visualDetails={visualDetails}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
