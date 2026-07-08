import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Testimonial } from "../types";
import { useTranslation } from "react-i18next";

const testimonialAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120",
];

type TestimonialCopy = Pick<
  Testimonial,
  "id" | "name" | "role" | "location" | "quote"
>;

export default function Testimonials() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const noMotion = !!reducedMotion;
  const [isPaused, setIsPaused] = useState(false);
  const testimonialsData = t("sections.testimonials.items", {
    returnObjects: true,
  });
  const testimonialCopies = Array.isArray(testimonialsData)
    ? (testimonialsData as TestimonialCopy[])
    : [];
  const testimonials: Testimonial[] = testimonialCopies.map((item, index) => ({
    id: item.id,
    name: item.name,
    role: item.role,
    location: item.location,
    quote: item.quote,
    avatar: testimonialAvatars[index] || testimonialAvatars[0],
    rating: 5,
  }));
  const marqueeItems = [...testimonials, ...testimonials];

  return (
    <section className="landing-section overflow-hidden bg-[#f6f1e7] text-[#17231a]">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="landing-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {t("sections.testimonials.headline")}
          </h2>
          <p className="landing-muted mt-4 text-base leading-7 sm:text-lg">
            {t("sections.testimonials.subtext")}
          </p>
        </motion.div>
      </div>

      <div className="mt-10 overflow-hidden">
        <div
          className={`landing-testimonials-marquee flex w-max gap-5 px-4 ${
            noMotion ? "landing-testimonials-marquee-static" : ""
          }`}
          style={{ animationPlayState: isPaused ? "paused" : "running" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={() => setIsPaused(false)}
        >
          {marqueeItems.map((testimonial, index) => (
            <article
              key={`${testimonial.id}-${index}`}
              className="landing-soft-card w-[300px] shrink-0 p-5 text-[#17231a] sm:w-[360px]"
              tabIndex={0}
            >
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.avatar}
                  alt={`${testimonial.name} avatar`}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3 className="font-bold">{testimonial.name}</h3>
                  <p className="text-sm text-[#66715f]">
                    {testimonial.role}, {testimonial.location}
                  </p>
                </div>
              </div>
              <p className="landing-muted mt-5 text-sm leading-6">"{testimonial.quote}"</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
