import { motion, cubicBezier } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const easeSmooth = cubicBezier(0.25, 0.46, 0.45, 0.94);
/** Image: public/images/tuneslogo.png (exact file updated in codebase) */
const TUNES_LOGO_IMAGE = '/images/tuneslogo.png';

export default function LocalTunesHero() {
  const { t } = useTranslation();

  return (
    <section className="pt-4 sm:pt-6 lg:pt-8 pb-0 mb-0" style={{ backgroundColor: 'hsl(var(--cool-mist))' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          {/* Left: Content - staggered animations */}
          <div className="text-left mb-2 sm:mb-4">
            {/* "Tunes" - fade + slide up */}
            <motion.h2
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: easeSmooth }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4"
              style={{ color: "hsl(var(--evergreen))" }}
            >
              {t('sections.localTunes.mainHeading', { defaultValue: 'Tunes' })}
            </motion.h2>
            
            {/* "Listen as you explore" - slight delay, fade + slide up */}
            <motion.h3
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12, ease: easeSmooth }}
              viewport={{ once: true }}
              className="text-2xl sm:text-3xl md:text-4xl font-medium mb-2 sm:mb-4 text-charcoal"
            >
              {t('sections.localTunes.title')}
            </motion.h3>
            
            {/* Paragraph - staggered fade-in */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.24, ease: easeSmooth }}
              viewport={{ once: true }}
              className="text-base sm:text-lg md:text-xl text-gray-700 mb-4 sm:mb-6 max-w-3xl mr-auto leading-relaxed whitespace-pre-line"
            >
              {t('sections.localTunes.body')}
            </motion.div>

            {/* "Explore Tunes" button - soft scale-in + hover micro-interaction */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.36, ease: easeSmooth }}
              viewport={{ once: true }}
              className="flex items-center justify-start mb-0 sm:mb-2"
            >
              <motion.button
                className="px-8 py-3.5 text-white font-semibold rounded-xl w-full sm:w-auto"
                style={{ backgroundColor: 'hsl(var(--blue-cta))' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2, ease: easeSmooth }}
              >
                {t('sections.localTunes.exploreButton', { defaultValue: 'Explore Tunes' })}
              </motion.button>
            </motion.div>
          </div>

          {/* Right: Phone mockup — animation isolated so section background does not shake */}
          <div className="relative flex items-center justify-center lg:justify-end lg:mr-8 -ml-4 sm:-ml-6 lg:-ml-8 overflow-hidden min-h-0 py-2 px-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: easeSmooth }}
              viewport={{ once: true }}
              className="relative flex items-center justify-center lg:justify-end"
            >
              <motion.div
                className="relative lg:-translate-x-6"
                style={{
                  willChange: 'transform',
                  backfaceVisibility: 'hidden' as const,
                  transform: 'translateZ(0)',
                }}
                animate={{
                  x: [0, 10, 0, -10, 0],
                  y: [0, -6, 0, 6, 0],
                  rotate: [0, 6, 0, -6, 0],
                  scale: [1, 1.015, 1, 1.015, 1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: cubicBezier(0.4, 0, 0.2, 1),
                }}
                whileHover={{ scale: 1.02 }}
              >
                <img
                  src={TUNES_LOGO_IMAGE}
                  alt={t('sections.localTunes.mainHeading', { defaultValue: 'Tunes' })}
                  decoding="async"
                  className="block w-full max-w-[640px] sm:max-w-[640px] lg:max-w-[700px] h-auto max-h-[36rem] sm:max-h-[36rem] lg:max-h-[40rem] object-contain select-none"
                  style={{ pointerEvents: 'none', backfaceVisibility: 'hidden' }}
                  draggable={false}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
