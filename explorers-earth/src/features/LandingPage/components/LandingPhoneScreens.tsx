import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const PHONE_CARDS = [
  { id: 0, img: "/images/profile.png", alt: "Explorer profile preview" },
  { id: 1, img: "/images/recommendations1.png", alt: "Recommendations preview" },
  { id: 2, img: "/images/places.png", alt: "Places preview" },
  { id: 3, img: "/images/music.png", alt: "Music preview" },
] as const;

const IDLE_FLOAT_DURATION = 4;
const SHUFFLE_INTERVAL_MS = 4500;

function getArcLayout(slotIndex: number) {
  const arc = [
    { x: 24, y: -12, rotate: 5, scale: 1, zIndex: 40 },
    { x: 0, y: 0, rotate: 2, scale: 0.97, zIndex: 30 },
    { x: -28, y: 6, rotate: -3, scale: 0.94, zIndex: 20 },
    { x: -48, y: 8, rotate: -6, scale: 0.9, zIndex: 10 },
  ];

  return arc[slotIndex] ?? arc[0];
}

export function LandingPhoneScreens() {
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;

  useEffect(() => {
    if (noMotion) return;

    const id = window.setInterval(() => {
      setOrder((prev) => [...prev.slice(1), prev[0]]);
    }, SHUFFLE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [noMotion]);

  return (
    <div className="relative flex min-h-[430px] w-full items-center justify-center overflow-visible">
      {PHONE_CARDS.map((card, i) => {
        const slotIndex = order.indexOf(card.id);
        const arc = getArcLayout(slotIndex);

        return (
          <motion.div
            key={card.id}
            layout
            transition={{
              layout: { duration: noMotion ? 0 : 0.6, ease: "easeInOut" },
            }}
            className="absolute h-auto w-[190px] sm:w-[220px]"
            style={{ zIndex: arc.zIndex }}
            initial={false}
            animate={{
              x: arc.x,
              y: arc.y,
              rotate: arc.rotate,
              scale: arc.scale,
            }}
          >
            <motion.div
              className="w-full"
              animate={{ y: noMotion ? 0 : [0, -8, 0] }}
              transition={{
                y: {
                  duration: noMotion ? 0 : IDLE_FLOAT_DURATION,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.7,
                },
              }}
            >
              <motion.div
                className="relative w-full overflow-hidden rounded-[24px] bg-[#17231a] p-[5px] shadow-2xl"
              >
                <div
                  className="flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-neutral-900"
                  style={{ aspectRatio: "9 / 19" }}
                >
                  <img
                    src={card.img}
                    alt={card.alt}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
