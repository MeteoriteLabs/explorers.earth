import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { WorldMapFlightPaths } from "./BackgroundPatterns";
import { useTranslation } from "react-i18next";
import { UsernameClaimInput } from "./UsernameClaimInput";

const PHONE_CARDS = [
  { id: 0, img: "/images/profile.png", alt: "Profile" },
  { id: 1, img: "/images/recommendations1.png", alt: "Recommendations" },
  { id: 2, img: "/images/places.png", alt: "Places" },
  { id: 3, img: "/images/music.png", alt: "Music" },
] as const;

const PIN_DELAY = 0.35;
const PULSE_START = 1.4;
const MORPH_START = 2.4;
const MORPH_DURATION = 0.9;
const IDLE_FLOAT_DURATION = 4;
const SHUFFLE_INTERVAL_MS = 4500;
/** Map grid + map icon visible only at start; fades out before all 4 phone images */
const MAP_GRID_VISIBLE_UNTIL = 2;

function getArcLayout(slotIndex: number) {
  const arc = [
    { x: 24, y: -12, rotate: 5, scale: 1, zIndex: 40 },
    { x: 0, y: 0, rotate: 2, scale: 0.97, zIndex: 30 },
    { x: -28, y: 6, rotate: -3, scale: 0.94, zIndex: 20 },
    { x: -48, y: 8, rotate: -6, scale: 0.9, zIndex: 10 },
  ];
  return arc[slotIndex] ?? arc[0];
}

export default function Hero() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;

  useEffect(() => {
    if (noMotion) return;
    const id = setInterval(() => {
      setOrder((prev) => [...prev.slice(1), prev[0]]);
    }, SHUFFLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [noMotion]);

  return (
    <section
      id="hero"
      className="relative overflow-hidden min-h-screen flex items-center w-full pt-16 md:pt-0"
      style={{ backgroundColor: "hsl(var(--evergreen))", scrollMarginTop: "6rem" }}
    >
      <WorldMapFlightPaths />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 relative z-10 w-full max-w-7xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12 lg:gap-8">
        <div className="max-w-xl sm:max-w-2xl lg:max-w-[42rem]">
          {/* Content — tighter on mobile too; better line breaks */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-8"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
              {(() => {
                const headline = t("hero.headline");
                const breakAt = headline.indexOf(" - ");
                const recAt = headline.toLowerCase().indexOf("recommendations");
                if (breakAt === -1) return headline;
                if (recAt > 0 && breakAt > recAt) {
                  return (
                    <>
                      {headline.slice(0, recAt).trim()}
                      <br />
                      {headline.slice(recAt, breakAt + 3)}
                      <br />
                      {headline.slice(breakAt + 3)}
                    </>
                  );
                }
                return (
                  <>
                    {headline.slice(0, breakAt)} -
                    <br />
                    {headline.slice(breakAt + 3)}
                  </>
                );
              })()}
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed">
              {t("hero.subtext")}
            </p>
            <UsernameClaimInput username={username} setUsername={setUsername} />
          </motion.div>
        </div>

        {/* Right-side hero animation container — Map-to-Phone Morph only */}
        <div className="relative w-full lg:max-w-[640px] lg:min-h-[580px] flex items-center justify-center overflow-visible pointer-events-none">
          {/* 1. Background: thin dotted routes only (no circle); animate slowly */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.14]">
            <motion.svg
              viewBox="0 0 200 200"
              className="w-full max-w-[280px] h-auto"
              fill="none"
              aria-hidden
            >
              <motion.path
                d="M40 100 Q70 70 100 100 Q130 130 160 100"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 6"
                fill="none"
                initial={{ pathLength: 0, opacity: 0.6 }}
                animate={{
                  pathLength: 1,
                  opacity: 0.6,
                }}
                transition={{
                  pathLength: { duration: noMotion ? 0 : 8, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
                }}
              />
              <motion.path
                d="M100 40 Q130 70 100 100 Q70 130 100 160"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 6"
                fill="none"
                initial={{ pathLength: 0, opacity: 0.5 }}
                animate={{
                  pathLength: 1,
                  opacity: 0.5,
                }}
                transition={{
                  pathLength: { duration: noMotion ? 0 : 10, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
                }}
              />
            </motion.svg>
          </div>

          {/* Start-only: map grid abstract; fades out before 4 images */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{
              opacity: noMotion ? 0 : [0, 0.5, 0.5, 0],
            }}
            transition={{
              duration: MAP_GRID_VISIBLE_UNTIL + 0.4,
              times: [0, 0.15, MAP_GRID_VISIBLE_UNTIL / (MAP_GRID_VISIBLE_UNTIL + 0.4), 1],
            }}
            aria-hidden
          >
            <motion.svg
              viewBox="0 0 120 120"
              className="w-full max-w-[200px] sm:max-w-[240px] h-auto text-white"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Grid lines — abstract map lattice */}
              {Array.from({ length: 7 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1={10 + i * 16.67}
                  y1={10}
                  x2={10 + i * 16.67}
                  y2={110}
                  stroke="currentColor"
                  strokeWidth="0.4"
                  strokeOpacity="0.5"
                />
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={10}
                  y1={10 + i * 16.67}
                  x2={110}
                  y2={10 + i * 16.67}
                  stroke="currentColor"
                  strokeWidth="0.4"
                  strokeOpacity="0.5"
                />
              ))}
              {Array.from({ length: 5 }).flatMap((_, row) =>
                Array.from({ length: 5 }).map((_, col) => (
                  <circle
                    key={`${row}-${col}`}
                    cx={15 + col * 22.5}
                    cy={15 + row * 22.5}
                    r="1.2"
                    fill="currentColor"
                    fillOpacity="0.6"
                  />
                ))
              )}
            </motion.svg>
          </motion.div>

          {/* 2–4. Map pins → Phone morph + 5. Curved stack + 6. Idle float; order drives shuffle */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 440 }}>
            {PHONE_CARDS.map((card, i) => {
              const slotIndex = order.indexOf(card.id);
              const arc = getArcLayout(slotIndex);
              const pinDelay = PIN_DELAY * i;
              const pulseDelay = PULSE_START + i * 0.12;
              const morphDelay = MORPH_START + i * 0.18;

              return (
                <motion.div
                  key={card.id}
                  layout
                  transition={{
                    layout: { duration: noMotion ? 0 : 0.6, ease: "easeInOut" },
                  }}
                  className="absolute w-[200px] sm:w-[220px] h-auto"
                  style={{
                    zIndex: arc.zIndex,
                  }}
                  initial={false}
                  animate={{
                    x: arc.x,
                    y: arc.y,
                    rotate: arc.rotate,
                    scale: arc.scale,
                  }}
                >
                  {/* Idle float: inner wrapper so arc layout is preserved */}
                  <motion.div
                    className="w-full"
                    animate={{
                      y: noMotion ? 0 : [0, -8, 0],
                    }}
                    transition={{
                      y: {
                        duration: noMotion ? 0 : IDLE_FLOAT_DURATION,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.7,
                      },
                    }}
                  >
                    {/* Phone frame: rounded rectangle, px radius only; overflow hidden */}
                    <motion.div
                      className="w-full rounded-[24px] bg-neutral-800 shadow-xl overflow-hidden relative p-[5px]"
                      initial={{
                        scale: 0.45,
                        borderRadius: 9999,
                      }}
                      animate={{
                        scale: 1,
                        borderRadius: 24,
                      }}
                      transition={{
                        scale: {
                          duration: noMotion ? 0 : MORPH_DURATION,
                          delay: morphDelay,
                          ease: "easeOut",
                        },
                        borderRadius: {
                          duration: noMotion ? 0 : MORPH_DURATION,
                          delay: morphDelay,
                          ease: "easeOut",
                        },
                      }}
                    >
                      {/* Map pin icon: hidden until map grid fades, then fade in sequentially, pulse once, fade out on morph */}
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: noMotion ? 0 : [0, 0, 1, 1, 0],
                        }}
                        transition={{
                          duration: 5,
                          times: [
                            0,
                            MAP_GRID_VISIBLE_UNTIL / 5,
                            (MAP_GRID_VISIBLE_UNTIL + pinDelay) / 5,
                            (morphDelay + MORPH_DURATION * 0.5) / 5,
                            1,
                          ],
                        }}
                      >
                        <motion.div
                          className="text-white drop-shadow-md flex items-center justify-center"
                          initial={{ scale: 1 }}
                          animate={{ scale: noMotion ? 1 : [1, 1.12, 1] }}
                          transition={{
                            duration: noMotion ? 0 : 0.5,
                            delay: Math.max(pulseDelay, MAP_GRID_VISIBLE_UNTIL + pinDelay * 0.5),
                            ease: "easeInOut",
                          }}
                        >
                          <MapPin className="w-6 h-6 sm:w-7 sm:h-7 fill-white/95 stroke-white stroke-[2.5]" strokeLinejoin="round" />
                        </motion.div>
                      </motion.div>
                      {/* Screen: rounded rect 9:19, overflow hidden; image contain, full content visible */}
                      <motion.div
                        className="w-full overflow-hidden rounded-[20px] bg-neutral-900 flex items-center justify-center"
                        style={{ aspectRatio: "9 / 19" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: morphDelay + MORPH_DURATION * 0.5,
                        }}
                      >
                        <img
                          src={card.img}
                          alt={card.alt}
                          className="w-full h-full object-contain min-w-0 min-h-0"
                          style={{ objectFit: "contain", width: "100%", height: "100%" }}
                          loading="lazy"
                          decoding="async"
                        />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
