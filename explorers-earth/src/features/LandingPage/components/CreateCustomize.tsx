import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Image: public/images/recommendations.png
 * Dev: timestamp in URL so each full refresh bypasses cache and loads the latest file.
 * Prod: bump v= when you replace the image. If you still see the old image, restart the dev server.
 */
const RECOMMENDATIONS_IMG =
  import.meta.env.DEV
    ? `/images/recommendations.png?v=${Date.now()}`
    : '/images/recommendations.png?v=2';

export default function CreateCustomize() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" className="py-6 sm:py-8 lg:py-10 overflow-x-hidden" style={{ backgroundColor: 'hsl(var(--soft-off-white))' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1.35fr] gap-8 lg:gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-6 lg:pr-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal leading-tight">
              {t('sections.createCustomize.headline')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed">
              {t('sections.createCustomize.subtext')}
            </p>

            {/* Bullet Points */}
            <div className="space-y-4 mt-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-charcoal">{t('sections.createCustomize.bulletPoints.addSpots.title')}</h4>
                  {t('sections.createCustomize.bulletPoints.addSpots.description') && (
                    <p className="text-gray-600">{t('sections.createCustomize.bulletPoints.addSpots.description')}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-charcoal">{t('sections.createCustomize.bulletPoints.organize.title')}</h4>
                  {t('sections.createCustomize.bulletPoints.organize.description') && (
                    <p className="text-gray-600">{t('sections.createCustomize.bulletPoints.organize.description')}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-charcoal">{t('sections.createCustomize.bulletPoints.generate.title')}</h4>
                  {t('sections.createCustomize.bulletPoints.generate.description') && (
                    <p className="text-gray-600">{t('sections.createCustomize.bulletPoints.generate.description')}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <CheckCircle className="text-green-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-charcoal">{t('sections.createCustomize.bulletPoints.share.title')}</h4>
                  {t('sections.createCustomize.bulletPoints.share.description') && (
                    <p className="text-gray-600">{t('sections.createCustomize.bulletPoints.share.description')}</p>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* UI Dashboard Mockup — animation contained so section background does not shake */}
          <div className="relative min-w-0 sm:min-w-0 max-sm:w-full flex justify-center lg:justify-end overflow-hidden min-h-0 py-2">
            <motion.div
              initial={{ scale: 0.6, opacity: 0.2 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 190, damping: 23 }}
              style={{ transformOrigin: 'center center' }}
              className="relative overflow-visible -translate-x-12"
            >
              <motion.div
                animate={{
                  scale: [0.9, 1.08, 0.9],
                  opacity: [0.9, 1, 0.9],
                }}
                transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ transformOrigin: 'center center' }}
                className="relative"
              >
                <img
                  src={RECOMMENDATIONS_IMG}
                  alt=""
                  className="block w-full max-w-[640px] sm:max-w-[640px] lg:max-w-[700px] h-auto max-h-[36rem] sm:max-h-[36rem] lg:max-h-[40rem] object-contain bg-transparent"
                  style={{ boxShadow: 'none', backgroundColor: 'transparent' }}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
